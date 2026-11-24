//! Readability, style, spelling, and grammar analysis of Markdown text.
//!
//! The analysis looks only at prose. It ignores code, URLs, raw HTML, and YAML front matter.
//! All offsets are UTF-16 code units into the full input text, as the editor uses.

mod blocks;
mod finding;
mod harper;
mod offsets;
mod prose;
mod stats;
mod style;

#[cfg(test)]
mod tests;

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;

use serde::Serialize;

use finding::{BlockText, Finding};
use harper::Harper;
use offsets::Utf16Cursor;
use stats::Counts;
pub use stats::Stats;

/// The result of an analysis.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Analysis {
    pub stats: Stats,
    /// The issues, sorted by start offset.
    pub issues: Vec<Issue>,
}

/// The kind of an issue.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum IssueKind {
    /// A sentence with a grade level of 14 or more.
    VeryHard,
    /// A sentence with a grade level from 10 to less than 14.
    Hard,
    Adverb,
    Passive,
    /// A phrase that has a shorter or simpler alternative.
    Wordy,
    Spelling,
    Grammar,
}

impl IssueKind {
    /// Gives the name of the kind, as it is in JSON.
    ///
    /// ```
    /// use steinbeck_lib::analysis::IssueKind;
    ///
    /// assert_eq!(IssueKind::VeryHard.as_str(), "veryHard");
    /// ```
    pub fn as_str(self) -> &'static str {
        match self {
            Self::VeryHard => "veryHard",
            Self::Hard => "hard",
            Self::Adverb => "adverb",
            Self::Passive => "passive",
            Self::Wordy => "wordy",
            Self::Spelling => "spelling",
            Self::Grammar => "grammar",
        }
    }
}

/// A problem in the text.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Issue {
    /// An identifier that stays the same across analyses for the same kind, text, and
    /// occurrence number of that text.
    pub id: String,
    pub kind: IssueKind,
    /// The UTF-16 start offset.
    pub from: usize,
    /// The UTF-16 end offset.
    pub to: usize,
    /// A short description in plain English.
    pub message: String,
    /// Edits that fix the issue. This can be empty.
    pub fixes: Vec<Fix>,
}

/// An edit that replaces the UTF-16 range `from..to` with `insert`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Fix {
    /// The text to show for the fix, for example "cut" or the replacement word.
    pub label: String,
    pub from: usize,
    pub to: usize,
    pub insert: String,
}

/// The cached analysis of one Markdown block, with offsets relative to the block start.
struct BlockResult {
    counts: Counts,
    findings: Vec<Finding>,
}

/// The key of a cached block: the heading flag and the block text.
type BlockKey = (bool, String);

/// Analyzes Markdown text.
///
/// Make one `Analyzer` and keep it. It is expensive to make, and it keeps a cache of the
/// analysis of each top-level Markdown block. Thus a new analysis after a small edit is fast.
///
/// ```
/// use steinbeck_lib::analysis::{Analyzer, IssueKind};
///
/// let mut analyzer = Analyzer::new(["Steinbeckian"]);
/// let analysis = analyzer.analyze("It was **really** good.");
///
/// assert_eq!(analysis.stats.words, 4);
/// let adverb = &analysis.issues[0];
/// assert_eq!(adverb.kind, IssueKind::Adverb);
/// assert_eq!((adverb.from, adverb.to), (9, 15));
/// ```
pub struct Analyzer {
    user_words: Vec<String>,
    /// One Harper linter for each worker thread.
    harpers: Vec<Harper>,
    cache: HashMap<BlockKey, Arc<BlockResult>>,
}

/// The maximum number of threads that analyze blocks that are not in the cache.
///
/// Each worker has its own Harper linter, which uses approximately 11 MB of memory.
const MAX_WORKERS: usize = 6;

impl Analyzer {
    /// Makes an analyzer. The spelling check accepts each word in `user_words`.
    pub fn new<S: Into<String>>(user_words: impl IntoIterator<Item = S>) -> Self {
        let user_words: Vec<String> = user_words.into_iter().map(Into::into).collect();

        Self {
            harpers: harpers(&user_words),
            user_words,
            cache: HashMap::new(),
        }
    }

    /// Adds `word` to the words that the spelling check accepts.
    ///
    /// ```
    /// use steinbeck_lib::analysis::Analyzer;
    ///
    /// let mut analyzer = Analyzer::new(Vec::<String>::new());
    /// analyzer.add_word("Zorblat");
    /// assert!(analyzer.analyze("Zorblat is here.").issues.is_empty());
    /// ```
    pub fn add_word(&mut self, word: &str) {
        self.user_words.push(word.to_owned());
        self.harpers = harpers(&self.user_words);
        self.cache.clear();
    }

    /// Analyzes the Markdown text `text`.
    pub fn analyze(&mut self, text: &str) -> Analysis {
        let started = Instant::now();
        let blocks = blocks::prose_blocks(text);
        let keys: Vec<BlockKey> = blocks
            .iter()
            .map(|b| (b.heading, text[b.range.clone()].to_owned()))
            .collect();

        let mut previous = std::mem::take(&mut self.cache);
        let mut missing = Vec::new();
        for key in &keys {
            if self.cache.contains_key(key) {
                continue;
            }
            match previous.remove(key) {
                Some(result) => {
                    self.cache.insert(key.clone(), result);
                }
                None if !missing.contains(&key) => missing.push(key),
                None => {}
            }
        }
        let missed = missing.len();
        self.cache
            .extend(analyze_blocks(&mut self.harpers, &missing));

        let mut cursor = Utf16Cursor::new(text);
        let mut counts = Counts::default();
        let mut findings = Vec::new();
        for (block, key) in blocks.iter().zip(&keys) {
            let base = cursor.advance_to(block.range.start);
            let result = &self.cache[key];
            counts += result.counts;
            findings.extend(result.findings.iter().map(|f| {
                let mut f = f.clone();
                f.move_offsets(|offset| offset + base);
                f
            }));
        }

        let characters = cursor.advance_to(text.len());
        let analysis = Analysis {
            stats: counts.stats(characters),
            issues: issues(findings),
        };

        log::debug!(
            "analyzed {} blocks ({missed} not cached), {} issues, in {:?}",
            keys.len(),
            analysis.issues.len(),
            started.elapsed()
        );
        analysis
    }
}

/// Makes one Harper linter for each worker thread, in parallel.
fn harpers(user_words: &[String]) -> Vec<Harper> {
    let started = Instant::now();
    let workers = std::thread::available_parallelism()
        .map_or(1, usize::from)
        .min(MAX_WORKERS);

    let harpers: Vec<Harper> = std::thread::scope(|scope| {
        let handles: Vec<_> = (0..workers)
            .map(|_| scope.spawn(|| Harper::new(user_words)))
            .collect();
        handles
            .into_iter()
            .map(|h| h.join().expect("Harper setup thread panicked"))
            .collect()
    });

    log::debug!("made {workers} Harper linters in {:?}", started.elapsed());
    harpers
}

/// Analyzes the blocks of `keys` in parallel, with one thread for each Harper linter.
fn analyze_blocks(harpers: &mut [Harper], keys: &[&BlockKey]) -> Vec<(BlockKey, Arc<BlockResult>)> {
    let workers = harpers.len().min(keys.len());

    std::thread::scope(|scope| {
        let handles: Vec<_> = harpers
            .iter_mut()
            .take(workers)
            .enumerate()
            .map(|(worker, harper)| {
                scope.spawn(move || {
                    keys.iter()
                        .skip(worker)
                        .step_by(workers)
                        .map(|key| {
                            let result = analyze_block(harper, &key.1, key.0);
                            ((*key).clone(), Arc::new(result))
                        })
                        .collect::<Vec<_>>()
                })
            })
            .collect();
        handles
            .into_iter()
            .flat_map(|h| h.join().expect("analysis thread panicked"))
            .collect()
    })
}

fn analyze_block(harper: &mut Harper, markdown: &str, heading: bool) -> BlockResult {
    let document = harper.document(markdown);
    let text = BlockText::new(document.get_source());
    let sentences = prose::sentences(&document);

    let mut counts = Counts::default();
    for sentence in &sentences {
        counts += Counts {
            words: sentence.words.len(),
            sentences: 1,
            letters: sentence
                .words
                .iter()
                .map(|w| style::letter_count(&w.lower))
                .sum(),
            syllables: sentence
                .words
                .iter()
                .map(|w| stats::syllables(&w.lower))
                .sum(),
        };
    }

    let mut findings = style::check(&sentences, heading, &text);
    findings.extend(harper.check(&document, &text));

    BlockResult { counts, findings }
}

/// Sorts `findings`, merges findings of the same kind on the same range, and gives each
/// a stable identifier.
fn issues(mut findings: Vec<Finding>) -> Vec<Issue> {
    findings.sort_by_key(|f| (f.from, f.to, f.kind));

    let mut merged: Vec<Finding> = Vec::with_capacity(findings.len());
    for finding in findings {
        match merged.last_mut() {
            Some(last)
                if (last.kind, last.from, last.to) == (finding.kind, finding.from, finding.to) =>
            {
                last.fixes.extend(finding.fixes);
            }
            _ => merged.push(finding),
        }
    }

    for finding in &mut merged {
        let mut unique: Vec<Fix> = Vec::with_capacity(finding.fixes.len());
        for fix in finding.fixes.drain(..) {
            if !unique
                .iter()
                .any(|u| (u.from, u.to, &u.insert) == (fix.from, fix.to, &fix.insert))
            {
                unique.push(fix);
            }
        }
        finding.fixes = unique;
    }

    let mut occurrences: HashMap<(IssueKind, u64), usize> = HashMap::new();
    merged
        .into_iter()
        .map(|finding| {
            let occurrence = occurrences
                .entry((finding.kind, finding.text_hash))
                .or_default();
            *occurrence += 1;

            Issue {
                id: format!(
                    "{}-{:016x}-{occurrence}",
                    finding.kind.as_str(),
                    finding.text_hash
                ),
                kind: finding.kind,
                from: finding.from,
                to: finding.to,
                message: finding.message.into_owned(),
                fixes: finding.fixes,
            }
        })
        .collect()
}
