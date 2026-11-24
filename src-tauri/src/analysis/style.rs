use std::sync::LazyLock;

use harper_core::Span;

use super::IssueKind;
use super::finding::{BlockText, Finding};
use super::prose::{Sentence, Word};
use super::stats::ari;

/// Sentences with fewer words than this are never hard.
const MIN_HARD_WORDS: usize = 8;
/// The grade level at which a sentence is hard.
const HARD_GRADE: f64 = 10.0;
/// The grade level at which a sentence is very hard.
const VERY_HARD_GRADE: f64 = 14.0;

/// Words that end in "-ly" but are usually not adverbs, or are adverbs that are not a problem.
const NOT_ADVERBS: &[&str] = &[
    "only",
    "family",
    "reply",
    "early",
    "likely",
    "unlikely",
    "supply",
    "apply",
    "july",
    "italy",
    "belly",
    "holy",
    "ugly",
    "friendly",
    "lovely",
    "lonely",
    "lively",
    "silly",
    "jelly",
    "bully",
    "rely",
    "ally",
    "fly",
    "butterfly",
    "daily",
    "weekly",
    "monthly",
    "yearly",
    "hourly",
    "elderly",
    "costly",
    "deadly",
    "orderly",
    "curly",
    "chilly",
    "hilly",
    "assembly",
    "anomaly",
    "melancholy",
    "monopoly",
    "rally",
    "tally",
    "comply",
    "imply",
    "multiply",
    "ply",
    "sly",
    "wily",
    "jolly",
    "folly",
    "lily",
    "emily",
    "kelly",
    "sally",
    "molly",
    "beverly",
    "scholarly",
    "cowardly",
    "manly",
    "womanly",
    "worldly",
    "kindly",
    "timely",
    "homely",
    "ghastly",
    "surly",
    "burly",
    "gnarly",
    "bodily",
    "comely",
    "courtly",
    "leisurely",
    "neighborly",
    "sickly",
    "wobbly",
    "bubbly",
    "prickly",
    "smelly",
    "woolly",
    "grizzly",
];

/// Forms of the verb "be".
const BE_FORMS: &[&str] = &["am", "is", "are", "was", "were", "be", "been", "being"];

/// Past participles that do not end in "-ed".
const IRREGULAR_PARTICIPLES: &[&str] = &[
    "arisen",
    "awoken",
    "beaten",
    "become",
    "begun",
    "bent",
    "bitten",
    "blown",
    "bought",
    "bound",
    "bred",
    "broken",
    "brought",
    "built",
    "burnt",
    "caught",
    "chosen",
    "dealt",
    "done",
    "drawn",
    "driven",
    "eaten",
    "fallen",
    "fed",
    "felt",
    "fought",
    "found",
    "forbidden",
    "forgiven",
    "forgotten",
    "frozen",
    "given",
    "gone",
    "grown",
    "heard",
    "held",
    "hidden",
    "hit",
    "hung",
    "hurt",
    "kept",
    "known",
    "laid",
    "led",
    "left",
    "lent",
    "lit",
    "lost",
    "made",
    "meant",
    "met",
    "paid",
    "proven",
    "put",
    "read",
    "ridden",
    "risen",
    "run",
    "said",
    "sat",
    "seen",
    "sent",
    "set",
    "shaken",
    "shed",
    "shot",
    "shown",
    "shut",
    "sold",
    "sought",
    "spent",
    "spoken",
    "spun",
    "stolen",
    "struck",
    "stuck",
    "sung",
    "sworn",
    "swept",
    "taken",
    "taught",
    "thought",
    "thrown",
    "told",
    "torn",
    "understood",
    "upheld",
    "won",
    "worn",
    "woven",
    "wound",
    "written",
];

/// Wordy phrases and simpler words to use. An empty replacement means "cut the phrase".
const WORDY: &[(&str, &[&str])] = &[
    ("a large number of", &["many"]),
    ("a number of", &["some", "many"]),
    ("additional", &["more", "extra"]),
    ("are able to", &["can"]),
    ("assistance", &["help"]),
    ("at the present time", &["now"]),
    ("at this point in time", &["now"]),
    ("basic fundamentals", &["fundamentals"]),
    ("commence", &["begin", "start"]),
    ("demonstrate", &["show"]),
    ("despite the fact that", &["although"]),
    ("due to the fact that", &["because"]),
    ("each and every", &["each", "every"]),
    ("end result", &["result"]),
    ("facilitate", &["help"]),
    ("first and foremost", &["first"]),
    ("for the purpose of", &["for"]),
    ("free gift", &["gift"]),
    ("has the ability to", &["can"]),
    ("have the ability to", &["can"]),
    ("in close proximity to", &["near"]),
    ("in order to", &["to"]),
    ("in regard to", &["about"]),
    ("in spite of the fact that", &["although"]),
    ("in the event that", &["if"]),
    ("in the near future", &["soon"]),
    ("is able to", &["can"]),
    ("it is important to note that", &[""]),
    ("it should be noted that", &[""]),
    ("just", &[""]),
    ("needless to say", &[""]),
    ("numerous", &["many"]),
    ("on a daily basis", &["daily"]),
    ("owing to the fact that", &["because"]),
    ("past history", &["history"]),
    ("prior to", &["before"]),
    ("quite", &[""]),
    ("subsequent to", &["after"]),
    ("sufficient", &["enough"]),
    ("terminate", &["end"]),
    ("the majority of", &["most"]),
    ("utilization", &["use"]),
    ("utilize", &["use"]),
    ("utilized", &["used"]),
    ("utilizes", &["uses"]),
    ("very", &[""]),
    ("very much", &[""]),
    ("with regard to", &["about"]),
    ("with respect to", &["about"]),
];

/// A wordy phrase, split into words.
struct Phrase {
    words: Vec<&'static str>,
    replacements: &'static [&'static str],
}

/// The wordy phrases, with the longest phrases first so that the longest match wins.
static PHRASES: LazyLock<Vec<Phrase>> = LazyLock::new(|| {
    let mut phrases: Vec<Phrase> = WORDY
        .iter()
        .map(|(phrase, replacements)| Phrase {
            words: phrase.split(' ').collect(),
            replacements,
        })
        .collect();
    phrases.sort_by_key(|p| std::cmp::Reverse(p.words.len()));
    phrases
});

/// Finds hard sentences, adverbs, passive voice, and wordy phrases in `sentences`.
///
/// Sentences in a heading are never hard.
pub(super) fn check(sentences: &[Sentence], heading: bool, text: &BlockText) -> Vec<Finding> {
    let mut findings = Vec::new();

    for sentence in sentences {
        if !heading {
            findings.extend(hardness(sentence, text));
        }
        findings.extend(
            sentence
                .words
                .iter()
                .filter(|w| is_adverb(w))
                .map(|w| adverb(w, text)),
        );
        findings.extend(passives(&sentence.words, text));
        findings.extend(wordy(&sentence.words, text));
    }

    findings
}

fn hardness(sentence: &Sentence, text: &BlockText) -> Option<Finding> {
    let words = sentence.words.len();
    if words < MIN_HARD_WORDS {
        return None;
    }

    let letters: usize = sentence.words.iter().map(|w| letter_count(&w.lower)).sum();
    let grade = ari(letters as f64 / words as f64, words as f64);

    let (kind, message) = if grade >= VERY_HARD_GRADE {
        (
            IssueKind::VeryHard,
            "Very hard to read. Split this sentence, or make it simpler.",
        )
    } else if grade >= HARD_GRADE {
        (
            IssueKind::Hard,
            "Hard to read. Make this sentence shorter or simpler.",
        )
    } else {
        return None;
    };

    Some(text.finding(kind, sentence.span, message, Vec::new()))
}

/// Gives the number of letters and digits in `word`.
pub(super) fn letter_count(word: &str) -> usize {
    word.chars().filter(|c| c.is_alphanumeric()).count()
}

fn is_adverb(word: &Word) -> bool {
    let known_not_adverb = !word.kind.is_oov() && !word.kind.is_adverb();

    word.lower.len() > 3
        && word.lower.ends_with("ly")
        && !NOT_ADVERBS.contains(&word.lower.as_str())
        && !known_not_adverb
}

fn adverb(word: &Word, text: &BlockText) -> Finding {
    text.finding(
        IssueKind::Adverb,
        word.span,
        "Adverb. Use a stronger verb, or cut it.",
        vec![text.cut(word.span)],
    )
}

fn is_participle(word: &Word) -> bool {
    let lower = word.lower.as_str();
    let regular =
        lower.len() > 3 && lower.ends_with("ed") && (word.kind.is_oov() || word.kind.is_verb());

    regular || IRREGULAR_PARTICIPLES.contains(&lower)
}

fn passives(words: &[Word], text: &BlockText) -> Vec<Finding> {
    let mut findings = Vec::new();

    for (i, be) in words.iter().enumerate() {
        if !BE_FORMS.contains(&be.lower.as_str()) {
            continue;
        }

        let next = |j: usize| words.get(j).filter(|w| w.joined);
        let participle = match next(i + 1) {
            Some(w) if is_participle(w) => Some(w),
            Some(w) if is_adverb(w) || w.kind.is_adverb() => {
                next(i + 2).filter(|w| is_participle(w))
            }
            _ => None,
        };

        if let Some(participle) = participle {
            findings.push(text.finding(
                IssueKind::Passive,
                Span::new(be.span.start, participle.span.end),
                "Passive voice. Use the active voice if you can.",
                Vec::new(),
            ));
        }
    }

    findings
}

fn wordy(words: &[Word], text: &BlockText) -> Vec<Finding> {
    let mut findings = Vec::new();
    let mut i = 0;

    while i < words.len() {
        let matched = PHRASES.iter().find(|phrase| {
            phrase.words.len() <= words.len() - i
                && phrase.words.iter().enumerate().all(|(k, expected)| {
                    let word = &words[i + k];
                    word.lower == *expected && (k == 0 || word.joined)
                })
        });

        let Some(phrase) = matched else {
            i += 1;
            continue;
        };

        let last = &words[i + phrase.words.len() - 1];
        let span = Span::new(words[i].span.start, last.span.end);
        let original = text.text(span);
        let capital = original.chars().next().is_some_and(char::is_uppercase);

        let fixes = phrase
            .replacements
            .iter()
            .map(|r| match *r {
                "" => text.cut(span),
                r => {
                    let r = if capital { capitalize(r) } else { r.to_owned() };
                    text.replace(span, &r, &r)
                }
            })
            .collect();

        let message = match phrase.replacements {
            [""] => "Wordy. Cut it.".to_owned(),
            replacements => format!("Wordy. Use “{}” instead.", replacements.join("” or “")),
        };

        findings.push(text.finding(IssueKind::Wordy, span, message, fixes));
        i += phrase.words.len();
    }

    findings
}

fn capitalize(word: &str) -> String {
    let mut chars = word.chars();
    chars
        .next()
        .map(|first| first.to_uppercase().chain(chars).collect())
        .unwrap_or_default()
}
