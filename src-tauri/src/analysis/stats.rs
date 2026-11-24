use std::ops::AddAssign;

use serde::Serialize;

/// The average adult reading speed, in words per minute.
const WORDS_PER_MINUTE: usize = 238;

/// Document statistics. All values are zero for a document without prose.
#[derive(Debug, Clone, Copy, PartialEq, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Stats {
    /// The number of prose words.
    pub words: usize,
    /// The number of characters in the full document, prose or not, in UTF-16 code units.
    pub characters: usize,
    /// The number of prose sentences.
    pub sentences: usize,
    /// The reading time in whole minutes. It is at least 1 if the document has words.
    pub reading_minutes: usize,
    /// The Automated Readability Index (a US grade level).
    pub ari: f64,
    /// The Flesch–Kincaid grade level.
    pub flesch_kincaid: f64,
    /// The Coleman–Liau index (a US grade level).
    pub coleman_liau: f64,
    /// The mean number of words in a sentence.
    pub words_per_sentence: f64,
}

/// Raw counts of prose, which can be added together across blocks.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub(super) struct Counts {
    pub words: usize,
    pub sentences: usize,
    pub letters: usize,
    pub syllables: usize,
}

impl AddAssign for Counts {
    fn add_assign(&mut self, other: Self) {
        self.words += other.words;
        self.sentences += other.sentences;
        self.letters += other.letters;
        self.syllables += other.syllables;
    }
}

impl Counts {
    /// Makes the statistics for these counts. `characters` is the UTF-16 length of the document.
    pub(super) fn stats(self, characters: usize) -> Stats {
        if self.words == 0 || self.sentences == 0 {
            return Stats {
                characters,
                ..Stats::default()
            };
        }

        let words = self.words as f64;
        let sentences = self.sentences as f64;
        let letters_per_word = self.letters as f64 / words;
        let words_per_sentence = words / sentences;

        Stats {
            words: self.words,
            characters,
            sentences: self.sentences,
            reading_minutes: self.words.div_ceil(WORDS_PER_MINUTE),
            ari: ari(letters_per_word, words_per_sentence),
            flesch_kincaid: 0.39 * words_per_sentence + 11.8 * (self.syllables as f64 / words)
                - 15.59,
            coleman_liau: 0.0588 * (letters_per_word * 100.0)
                - 0.296 * (sentences / words * 100.0)
                - 15.8,
            words_per_sentence,
        }
    }
}

/// Gives the Automated Readability Index.
pub(super) fn ari(letters_per_word: f64, words_per_sentence: f64) -> f64 {
    4.71 * letters_per_word + 0.5 * words_per_sentence - 21.43
}

/// Estimates the number of syllables in `word`. The result is at least 1.
///
/// The estimate counts groups of vowels, and does not count a silent final "e".
pub(super) fn syllables(word: &str) -> usize {
    let letters: Vec<char> = word
        .chars()
        .filter(char::is_ascii_alphabetic)
        .map(|c| c.to_ascii_lowercase())
        .collect();
    let is_vowel = |c: &char| matches!(c, 'a' | 'e' | 'i' | 'o' | 'u' | 'y');

    let mut count = 0;
    let mut previous_vowel = false;
    for c in &letters {
        let vowel = is_vowel(c);
        if vowel && !previous_vowel {
            count += 1;
        }
        previous_vowel = vowel;
    }

    let silent_e = match letters.as_slice() {
        [.., a, 'l', 'e'] => is_vowel(a),
        [.., a, 'e'] => !is_vowel(a),
        _ => false,
    };
    if silent_e && count > 1 {
        count -= 1;
    }

    count.max(1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn syllable_estimates() {
        let cases = [
            ("cat", 1),
            ("make", 1),
            ("table", 2),
            ("water", 2),
            ("beautiful", 3),
            ("readability", 5),
            ("the", 1),
            ("rhythm", 1),
            ("Steinbeck’s", 2),
        ];
        for (word, expected) in cases {
            assert_eq!(syllables(word), expected, "{word}");
        }
    }

    #[test]
    fn empty_counts_give_zero_stats_and_no_nan() {
        let stats = Counts::default().stats(12);
        assert_eq!(
            stats,
            Stats {
                characters: 12,
                ..Stats::default()
            }
        );
    }

    #[test]
    fn reading_minutes_round_up() {
        let counts = |words| Counts {
            words,
            sentences: 1,
            letters: words * 4,
            syllables: words,
        };
        let cases = [(1, 1), (238, 1), (239, 2), (476, 2), (477, 3)];
        for (words, minutes) in cases {
            assert_eq!(counts(words).stats(0).reading_minutes, minutes, "{words}");
        }
    }

    #[test]
    fn grade_formulas_match_published_definitions() {
        let stats = Counts {
            words: 100,
            sentences: 5,
            letters: 450,
            syllables: 150,
        }
        .stats(0);
        let close = |a: f64, b: f64| (a - b).abs() < 1e-9;
        assert!(close(stats.ari, 4.71 * 4.5 + 0.5 * 20.0 - 21.43));
        assert!(close(
            stats.flesch_kincaid,
            0.39 * 20.0 + 11.8 * 1.5 - 15.59
        ));
        assert!(close(
            stats.coleman_liau,
            0.0588 * 450.0 - 0.296 * 5.0 - 15.8
        ));
        assert!(close(stats.words_per_sentence, 20.0));
    }
}
