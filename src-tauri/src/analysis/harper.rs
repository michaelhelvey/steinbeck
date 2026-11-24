use std::collections::HashSet;
use std::sync::Arc;

use harper_core::linting::{Lint, LintGroup, LintKind, Linter, Suggestion};
use harper_core::spell::{FstDictionary, MergedDictionary, MutableDictionary};
use harper_core::{Dialect, DictWordMetadata, Document, Span};

use super::IssueKind;
use super::finding::{BlockText, Finding};

/// Harper rules that do the same work as the style rules of this module.
const DUPLICATE_RULES: &[&str] = &["LongSentences", "FillerWords", "Hedging"];

/// The Harper dictionary and linter. It is expensive to make, so make it one time and keep it.
pub(super) struct Harper {
    dictionary: Arc<MergedDictionary>,
    linter: LintGroup,
    /// The user words in lowercase.
    user_words: HashSet<String>,
}

impl Harper {
    /// Makes the Harper dictionary and linter, with `user_words` added to the dictionary.
    pub(super) fn new(user_words: &[String]) -> Self {
        let mut user = MutableDictionary::new();
        for word in user_words {
            user.append_word_str(word, DictWordMetadata::default());
        }

        let mut dictionary = MergedDictionary::new();
        dictionary.add_dictionary(FstDictionary::curated());
        dictionary.add_dictionary(Arc::new(user));
        let dictionary = Arc::new(dictionary);

        let mut linter = LintGroup::new_curated(dictionary.clone(), Dialect::American);
        for rule in DUPLICATE_RULES {
            assert!(linter.contains_key(rule), "unknown Harper rule {rule}");
            linter.config.set_rule_enabled(*rule, false);
        }

        Self {
            dictionary,
            linter,
            user_words: user_words.iter().map(|w| w.to_lowercase()).collect(),
        }
    }

    /// Parses `markdown` into a Harper document.
    pub(super) fn document(&self, markdown: &str) -> Document {
        Document::new_markdown_default(markdown, self.dictionary.as_ref())
    }

    /// Finds spelling and grammar issues in `document`.
    ///
    /// Harper has typo rules that do not use the dictionary (for example "teh" to "the").
    /// Thus this function also removes spelling issues on user words.
    pub(super) fn check(&mut self, document: &Document, text: &BlockText) -> Vec<Finding> {
        self.linter
            .lint(document)
            .into_iter()
            .map(|lint| finding(lint, text))
            .filter(|(span, finding)| {
                finding.kind != IssueKind::Spelling
                    || !self.user_words.contains(&text.text(*span).to_lowercase())
            })
            .map(|(_, finding)| finding)
            .collect()
    }
}

fn finding(lint: Lint, text: &BlockText) -> (Span<char>, Finding) {
    let kind = match lint.lint_kind {
        LintKind::Spelling | LintKind::Typo => IssueKind::Spelling,
        _ => IssueKind::Grammar,
    };

    let fixes = lint
        .suggestions
        .iter()
        .map(|suggestion| match suggestion {
            Suggestion::ReplaceWith(chars) => {
                let insert: String = chars.iter().collect();
                text.replace(lint.span, insert.trim(), &insert)
            }
            Suggestion::InsertAfter(chars) => {
                let insert: String = chars.iter().collect();
                let end = Span::empty(lint.span.end);
                text.replace(end, &format!("add “{insert}”"), &insert)
            }
            Suggestion::Remove => text.replace(lint.span, "cut", ""),
        })
        .collect();

    (
        lint.span,
        text.finding(kind, lint.span, quote(&lint.message), fixes),
    )
}

/// Changes Markdown code quotes (`word`) in a Harper message into typographic quotes (“word”).
fn quote(message: &str) -> String {
    let mut open = false;
    message
        .chars()
        .map(|c| match c {
            '`' => {
                open = !open;
                if open { '“' } else { '”' }
            }
            c => c,
        })
        .collect()
}
