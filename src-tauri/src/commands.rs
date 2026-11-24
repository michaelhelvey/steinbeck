//! The Tauri commands that the frontend calls.
//!
//! Each command that can block runs on a blocking thread, not on the main thread.

use std::io;
use std::sync::{Mutex, MutexGuard, OnceLock, PoisonError};

use serde::{Serialize, Serializer};
use tauri::{AppHandle, Manager, State};

use crate::analysis::{Analysis, Analyzer};
use crate::dictionary::{DictionaryError, UserDictionary};
use crate::opened::OpenedFiles;

/// An error from a command. The frontend gets the error message as a string.
#[derive(Debug, thiserror::Error)]
pub enum CommandError {
    #[error("could not read {path}: {source}")]
    Read { path: String, source: io::Error },
    #[error("could not write {path}: {source}")]
    Write { path: String, source: io::Error },
    #[error(transparent)]
    Dictionary(#[from] DictionaryError),
    #[error("a background task failed: {0}")]
    Task(#[from] tauri::Error),
}

impl Serialize for CommandError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

/// The analyzer and the user dictionary, kept in the Tauri state.
///
/// The analyzer is expensive to make, so the app makes it on the first use.
/// Call [`Engine::warm_up`] on a background thread at startup to make it early.
pub struct Engine {
    dictionary: UserDictionary,
    analyzer: OnceLock<Mutex<Analyzer>>,
}

impl Engine {
    /// Makes an engine that keeps user words in `dictionary`.
    pub fn new(dictionary: UserDictionary) -> Self {
        Self {
            dictionary,
            analyzer: OnceLock::new(),
        }
    }

    /// Makes the analyzer now, if it does not exist yet.
    pub fn warm_up(&self) {
        drop(self.analyzer());
    }

    fn analyzer(&self) -> MutexGuard<'_, Analyzer> {
        self.analyzer
            .get_or_init(|| {
                let words = self.dictionary.words().unwrap_or_else(|e| {
                    log::warn!("{e}; using no user words");
                    Vec::new()
                });
                Mutex::new(Analyzer::new(words))
            })
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
    }
}

async fn blocking<T: Send + 'static>(
    app: AppHandle,
    task: impl FnOnce(&AppHandle) -> Result<T, CommandError> + Send + 'static,
) -> Result<T, CommandError> {
    tauri::async_runtime::spawn_blocking(move || task(&app)).await?
}

/// Analyzes the Markdown text `text`.
#[tauri::command]
pub async fn analyze(app: AppHandle, text: String) -> Result<Analysis, CommandError> {
    blocking(app, move |app| {
        Ok(app.state::<Engine>().analyzer().analyze(&text))
    })
    .await
}

/// Adds `word` to the user dictionary file and to the analyzer.
#[tauri::command]
pub async fn add_to_dictionary(app: AppHandle, word: String) -> Result<(), CommandError> {
    blocking(app, move |app| {
        let engine = app.state::<Engine>();
        let word = engine.dictionary.append(&word)?;
        engine.analyzer().add_word(&word);
        Ok(())
    })
    .await
}

/// Reads the UTF-8 text file at `path`.
#[tauri::command]
pub async fn read_file(app: AppHandle, path: String) -> Result<String, CommandError> {
    blocking(app, move |_| {
        std::fs::read_to_string(&path).map_err(|source| CommandError::Read { path, source })
    })
    .await
}

/// Writes `contents` to the file at `path`, and replaces the file if it exists.
#[tauri::command]
pub async fn write_file(
    app: AppHandle,
    path: String,
    contents: String,
) -> Result<(), CommandError> {
    blocking(app, move |_| {
        std::fs::write(&path, contents).map_err(|source| CommandError::Write { path, source })
    })
    .await
}

/// Gives the paths of the files that the app was asked to open, and removes them.
#[tauri::command]
pub fn take_opened_files(files: State<'_, OpenedFiles>) -> Vec<String> {
    files.take()
}
