//! Files that the operating system asks the app to open.
//!
//! On macOS, `open -a Steinbeck notes.md` and Finder send an open-document event with file URLs.
//! On other platforms, and when the binary starts directly, the paths are command-line arguments.
//! Paths can arrive before the frontend is ready, so the app keeps them until the frontend takes
//! them with the `take_opened_files` command. The app also sends the `open-file` event for each
//! path.
//!
//! On a cold start from macOS, the open-document event arrives before the Tauri `setup` hook.
//! Thus the app must manage [`OpenedFiles`] on the builder, not in `setup`. Also, the log plugin
//! is not attached yet at that time, so the "opening" log line for that file is lost.

use std::path::{Path, PathBuf};
use std::sync::{Mutex, PoisonError};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Url};

/// The name of the event that the app sends for each file to open.
pub const OPEN_FILE_EVENT: &str = "open-file";

/// The payload of the `open-file` event.
#[derive(Debug, Clone, Serialize)]
pub struct OpenFile {
    /// The absolute path of the file.
    pub path: String,
}

/// The paths that the frontend has not taken yet.
#[derive(Debug, Default)]
pub struct OpenedFiles(Mutex<Vec<String>>);

impl OpenedFiles {
    /// Gives the pending paths and removes them.
    ///
    /// ```
    /// use steinbeck_lib::opened::OpenedFiles;
    ///
    /// let files = OpenedFiles::default();
    /// assert!(files.take().is_empty());
    /// ```
    pub fn take(&self) -> Vec<String> {
        std::mem::take(&mut *self.0.lock().unwrap_or_else(PoisonError::into_inner))
    }

    fn push(&self, path: String) {
        self.0
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .push(path);
    }
}

/// Gives the absolute paths of the `file:` URLs in `urls`. Other URLs are ignored.
///
/// ```
/// use steinbeck_lib::opened::paths_from_urls;
/// use tauri::Url;
///
/// let url = Url::parse("file:///tmp/My%20Notes.md").unwrap();
/// # #[cfg(unix)]
/// assert_eq!(paths_from_urls(&[url]), vec![std::path::PathBuf::from("/tmp/My Notes.md")]);
/// ```
pub fn paths_from_urls(urls: &[Url]) -> Vec<PathBuf> {
    urls.iter()
        .filter_map(|url| url.to_file_path().ok())
        .collect()
}

/// Gives the absolute paths of the files named in the command-line arguments `args`.
///
/// The first argument is the program, so it is ignored. Options (arguments that start with
/// `-`) and paths that are not existing files are also ignored. Relative paths are relative
/// to `cwd`.
pub fn paths_from_args(args: impl IntoIterator<Item = String>, cwd: &Path) -> Vec<PathBuf> {
    args.into_iter()
        .skip(1)
        .filter(|arg| !arg.starts_with('-'))
        .map(|arg| cwd.join(arg))
        .filter(|path| path.is_file())
        .collect()
}

/// Keeps each path in `paths` for the frontend, sends the `open-file` event for it, and brings
/// the main window to the front.
pub fn open(app: &AppHandle, paths: Vec<PathBuf>) {
    if paths.is_empty() {
        return;
    }

    let files = app.state::<OpenedFiles>();
    for path in paths {
        let Some(path) = path.to_str().map(str::to_owned) else {
            log::warn!("cannot open {}: the path is not UTF-8", path.display());
            continue;
        };
        log::info!("opening {path}");
        files.push(path.clone());
        if let Err(e) = app.emit(OPEN_FILE_EVENT, OpenFile { path }) {
            log::warn!("could not send the {OPEN_FILE_EVENT} event: {e}");
        }
    }

    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let focused = window
        .unminimize()
        .and_then(|()| window.show())
        .and_then(|()| window.set_focus());
    if let Err(e) = focused {
        log::warn!("could not bring the main window to the front: {e}");
    }
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    #[test]
    #[cfg(unix)]
    fn file_urls_become_decoded_absolute_paths() {
        let urls: Vec<Url> = [
            "file:///Users/me/My%20Notes/caf%C3%A9.md",
            "https://example.com/notes.md",
            "file:///tmp/a.markdown",
        ]
        .iter()
        .map(|u| Url::parse(u).unwrap())
        .collect();

        assert_eq!(
            paths_from_urls(&urls),
            vec![
                PathBuf::from("/Users/me/My Notes/café.md"),
                PathBuf::from("/tmp/a.markdown"),
            ]
        );
    }

    #[test]
    fn args_become_absolute_paths_of_existing_files() {
        let dir = std::env::temp_dir().join(format!("steinbeck-args-{}", std::process::id()));
        fs::create_dir_all(dir.join("sub")).unwrap();
        fs::write(dir.join("sub").join("draft.md"), "# Draft").unwrap();

        let args = [
            "steinbeck",
            "sub/draft.md",
            "missing.md",
            "-psn_0_123",
            "sub",
        ]
        .map(String::from);
        let paths = paths_from_args(args, &dir);

        assert_eq!(paths, vec![dir.join("sub").join("draft.md")]);
        assert!(paths.iter().all(|p| p.is_absolute()));

        fs::remove_dir_all(dir).unwrap();
    }
}
