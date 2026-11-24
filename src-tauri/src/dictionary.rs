//! The user dictionary: a text file with one word on each line.

use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::PathBuf;

/// An error from the user dictionary file.
#[derive(Debug, thiserror::Error)]
pub enum DictionaryError {
    #[error("could not read the dictionary {path}: {source}")]
    Read { path: PathBuf, source: io::Error },
    #[error("could not write the dictionary {path}: {source}")]
    Write { path: PathBuf, source: io::Error },
    #[error("“{0}” is not one word")]
    NotAWord(String),
}

/// The user dictionary file.
///
/// ```
/// use steinbeck_lib::dictionary::UserDictionary;
///
/// let dir = std::env::temp_dir().join(format!("steinbeck-doc-{}", std::process::id()));
/// let dictionary = UserDictionary::new(dir.join("dictionary.txt"));
/// assert!(dictionary.words()?.is_empty());
///
/// dictionary.append("Steinbeck")?;
/// assert_eq!(dictionary.words()?, vec!["Steinbeck"]);
/// # std::fs::remove_dir_all(dir).unwrap();
/// # Ok::<(), steinbeck_lib::dictionary::DictionaryError>(())
/// ```
#[derive(Debug, Clone)]
pub struct UserDictionary {
    path: PathBuf,
}

impl UserDictionary {
    /// Makes a dictionary that keeps its words in the file at `path`. The file can be missing.
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    /// Reads the words. A missing file gives no words. Blank lines are ignored.
    pub fn words(&self) -> Result<Vec<String>, DictionaryError> {
        let contents = match fs::read_to_string(&self.path) {
            Ok(contents) => contents,
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(source) => {
                return Err(DictionaryError::Read {
                    path: self.path.clone(),
                    source,
                });
            }
        };

        Ok(contents
            .lines()
            .map(str::trim)
            .filter(|w| !w.is_empty())
            .map(str::to_owned)
            .collect())
    }

    /// Adds `word` to the end of the file, and gives the trimmed word.
    ///
    /// The word must not be empty and must not contain whitespace.
    pub fn append(&self, word: &str) -> Result<String, DictionaryError> {
        let word = word.trim();
        if word.is_empty() || word.contains(char::is_whitespace) {
            return Err(DictionaryError::NotAWord(word.to_owned()));
        }

        let write_error = |source| DictionaryError::Write {
            path: self.path.clone(),
            source,
        };
        if let Some(dir) = self.path.parent() {
            fs::create_dir_all(dir).map_err(write_error)?;
        }
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)
            .map_err(write_error)?;
        writeln!(file, "{word}").map_err(write_error)?;

        Ok(word.to_owned())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn appended_words_are_read_back_and_bad_words_are_refused() {
        let dir = std::env::temp_dir().join(format!("steinbeck-dict-{}", std::process::id()));
        let dictionary = UserDictionary::new(dir.join("nested").join("dictionary.txt"));

        assert_eq!(dictionary.words().unwrap(), Vec::<String>::new());
        assert_eq!(dictionary.append("  Zorblat \n").unwrap(), "Zorblat");
        dictionary.append("teh").unwrap();
        for bad in ["", "   ", "two words", "line\nbreak"] {
            assert!(matches!(
                dictionary.append(bad),
                Err(DictionaryError::NotAWord(_))
            ));
        }
        assert_eq!(dictionary.words().unwrap(), vec!["Zorblat", "teh"]);

        fs::remove_dir_all(dir).unwrap();
    }
}
