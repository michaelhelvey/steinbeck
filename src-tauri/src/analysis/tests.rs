use std::sync::{LazyLock, Mutex, MutexGuard};
use std::time::Instant;

use super::{Analysis, Analyzer, Issue, IssueKind};

static SHARED: LazyLock<Mutex<Analyzer>> =
    LazyLock::new(|| Mutex::new(Analyzer::new(Vec::<String>::new())));

fn shared() -> MutexGuard<'static, Analyzer> {
    SHARED.lock().unwrap_or_else(|e| e.into_inner())
}

fn analyze(text: &str) -> Analysis {
    shared().analyze(text)
}

fn slice(text: &str, from: usize, to: usize) -> String {
    let units: Vec<u16> = text.encode_utf16().collect();
    String::from_utf16(&units[from..to]).expect("range must not split a surrogate pair")
}

fn found(text: &str, kind: IssueKind) -> Vec<String> {
    analyze(text)
        .issues
        .iter()
        .filter(|i| i.kind == kind)
        .map(|i| slice(text, i.from, i.to))
        .collect()
}

fn apply(text: &str, from: usize, to: usize, insert: &str) -> String {
    let mut units: Vec<u16> = text.encode_utf16().collect();
    units.splice(from..to, insert.encode_utf16());
    String::from_utf16(&units).expect("fix must give valid UTF-16")
}

#[test]
fn offsets_are_utf16_after_emoji_and_curly_quotes() {
    let text = "😀 “Quoted” — she said. 🎉🎉 I really think the cake was quickly eaten.";
    let analysis = analyze(text);

    let actual: Vec<(IssueKind, String)> = analysis
        .issues
        .iter()
        .filter(|i| matches!(i.kind, IssueKind::Adverb | IssueKind::Passive))
        .map(|i| (i.kind, slice(text, i.from, i.to)))
        .collect();

    assert_eq!(
        actual,
        vec![
            (IssueKind::Adverb, "really".to_owned()),
            (IssueKind::Passive, "was quickly eaten".to_owned()),
            (IssueKind::Adverb, "quickly".to_owned()),
        ]
    );

    for issue in &analysis.issues {
        for fix in &issue.fixes {
            slice(text, fix.from, fix.to);
        }
    }
}

#[test]
fn markdown_structure_decides_what_is_prose() {
    let cases = [
        ("```\nHe ran quickly.\n```\n", false),
        ("    He ran quickly.\n", false),
        ("Use `quickly` here.", false),
        ("See [the site](https://quickly.example.com).", false),
        ("Go to <https://quickly.example.com> now.", false),
        ("<div>He ran quickly.</div>\n", false),
        ("---\ntitle: He ran quickly\n---\n\nHello there.", false),
        ("He ran **quickly**.", true),
        ("He ran _quickly_.", true),
        ("- He ran quickly.\n- She walked.", true),
        ("> He ran quickly.", true),
        ("# He ran quickly", true),
        ("[He ran quickly](https://example.com)", true),
    ];

    for (text, flagged) in cases {
        let adverbs = found(text, IssueKind::Adverb);
        let expected: Vec<String> = if flagged {
            vec!["quickly".to_owned()]
        } else {
            vec![]
        };
        assert_eq!(adverbs, expected, "{text:?}");
    }
}

#[test]
fn style_rules_find_expected_text() {
    let cases: &[(&str, IssueKind, &[&str])] = &[
        ("She smiled warmly.", IssueKind::Adverb, &["warmly"]),
        ("My family is friendly and lovely.", IssueKind::Adverb, &[]),
        ("The only reply came early in July.", IssueKind::Adverb, &[]),
        ("It is likely to rain.", IssueKind::Adverb, &[]),
        (
            "The letter was written by Tom.",
            IssueKind::Passive,
            &["was written"],
        ),
        ("The door was opened.", IssueKind::Passive, &["was opened"]),
        (
            "The cake was quickly eaten.",
            IssueKind::Passive,
            &["was quickly eaten"],
        ),
        ("Mistakes were made.", IssueKind::Passive, &["were made"]),
        ("The car is red.", IssueKind::Passive, &[]),
        ("He was in bed.", IssueKind::Passive, &[]),
        ("They are hundred years old.", IssueKind::Passive, &[]),
        (
            "We utilize tools in order to win.",
            IssueKind::Wordy,
            &["utilize", "in order to"],
        ),
        (
            "A number of people came.",
            IssueKind::Wordy,
            &["A number of"],
        ),
        ("I thank you very much.", IssueKind::Wordy, &["very much"]),
        ("I justify the order to win.", IssueKind::Wordy, &[]),
    ];

    for (text, kind, expected) in cases {
        assert_eq!(found(text, *kind), *expected, "{text:?} {kind:?}");
    }
}

#[test]
fn sentence_grade_decides_hardness() {
    let very_hard = "The extraordinarily complicated administrative reorganization necessitated comprehensive consultation with representatives from numerous international organizations.";
    let hard = "The committee decided to postpone the final decision until the next quarterly meeting in March.";
    let short = "Incomprehensibility characterizes institutionalized bureaucracies.";
    let simple = "The cat sat on the mat and it was a good cat.";

    let kinds = |text: &str| -> Vec<IssueKind> {
        analyze(text)
            .issues
            .iter()
            .filter(|i| matches!(i.kind, IssueKind::Hard | IssueKind::VeryHard))
            .map(|i| i.kind)
            .collect()
    };

    assert_eq!(kinds(very_hard), vec![IssueKind::VeryHard]);
    assert_eq!(found(very_hard, IssueKind::VeryHard), vec![very_hard]);
    assert_eq!(kinds(hard), vec![IssueKind::Hard]);
    assert_eq!(kinds(short), vec![]);
    assert_eq!(kinds(simple), vec![]);
    assert_eq!(kinds(&format!("# {very_hard}")), vec![]);
    assert_eq!(
        found(&format!("> **{very_hard}**"), IssueKind::VeryHard),
        vec![very_hard]
    );
}

#[test]
fn spelling_suggests_fixes_and_user_words_silence_it() {
    let text = "I saw teh dog.";
    let mut analyzer = Analyzer::new(Vec::<String>::new());

    let spelling: Vec<Issue> = analyzer
        .analyze(text)
        .issues
        .into_iter()
        .filter(|i| i.kind == IssueKind::Spelling)
        .collect();
    assert_eq!(spelling.len(), 1);
    assert_eq!(slice(text, spelling[0].from, spelling[0].to), "teh");
    assert!(spelling[0].fixes.iter().any(|f| f.insert == "the"));

    analyzer.add_word("teh");
    let after = analyzer.analyze(text);
    assert_eq!(after.issues, vec![], "{after:?}");
}

#[test]
fn user_words_from_new_are_accepted() {
    let text = "Zorblat went home.";
    assert_eq!(found(text, IssueKind::Spelling), vec!["Zorblat"]);
    let mut analyzer = Analyzer::new(["Zorblat"]);
    assert_eq!(analyzer.analyze(text).issues, vec![]);
}

#[test]
fn grammar_errors_are_found() {
    assert_eq!(
        found("Their are always problems here.", IssueKind::Grammar),
        vec!["Their"]
    );
}

#[test]
fn fixes_give_clean_text() {
    let cases = [
        (
            "I really think so.",
            IssueKind::Adverb,
            "cut",
            "I think so.",
        ),
        ("He ran quickly.", IssueKind::Adverb, "cut", "He ran."),
        (
            "😀 I really think.",
            IssueKind::Adverb,
            "cut",
            "😀 I think.",
        ),
        (
            "We utilize tools.",
            IssueKind::Wordy,
            "use",
            "We use tools.",
        ),
        (
            "In order to win, train.",
            IssueKind::Wordy,
            "To",
            "To win, train.",
        ),
        (
            "I like it very much.",
            IssueKind::Wordy,
            "cut",
            "I like it.",
        ),
        (
            "I saw “teh” dog.",
            IssueKind::Spelling,
            "the",
            "I saw “the” dog.",
        ),
        (
            "Their are always problems.",
            IssueKind::Grammar,
            "There",
            "There are always problems.",
        ),
    ];

    for (text, kind, label, expected) in cases {
        let analysis = analyze(text);
        let fix = analysis
            .issues
            .iter()
            .filter(|i| i.kind == kind)
            .flat_map(|i| &i.fixes)
            .find(|f| f.label == label)
            .unwrap_or_else(|| panic!("no {label:?} fix in {text:?}: {analysis:?}"));
        assert_eq!(apply(text, fix.from, fix.to, &fix.insert), expected);
    }
}

#[test]
fn issues_are_sorted_and_not_duplicated() {
    let text = "She really ran very quickly. I saw teh dog, and teh cat. Their are two.";
    let issues = analyze(text).issues;

    assert!(issues.windows(2).all(|w| w[0].from <= w[1].from));
    let mut keys: Vec<_> = issues.iter().map(|i| (i.kind, i.from, i.to)).collect();
    let count = keys.len();
    keys.dedup();
    assert_eq!(keys.len(), count);

    for issue in &issues {
        let mut edits: Vec<_> = issue
            .fixes
            .iter()
            .map(|f| (f.from, f.to, &f.insert))
            .collect();
        edits.sort();
        edits.dedup();
        assert_eq!(edits.len(), issue.fixes.len(), "{issue:?}");
    }
}

#[test]
fn ids_are_stable_when_other_text_changes() {
    let before = "He ran quickly. She ran quickly.";
    let after = "A new first paragraph.\n\nHe ran quickly. She ran quickly.";

    let ids = |text: &str| -> Vec<String> {
        analyze(text)
            .issues
            .into_iter()
            .filter(|i| i.kind == IssueKind::Adverb)
            .map(|i| i.id)
            .collect()
    };

    let first = ids(before);
    assert_eq!(first.len(), 2);
    assert_ne!(first[0], first[1]);
    assert_eq!(ids(after), first);
}

#[test]
fn stats_count_prose_only() {
    let text = "---\ntitle: Front matter words\n---\n\n# Title\n\nOne **two** three. Four five.\n\n```\nnot words here\n```\n";
    let stats = analyze(text).stats;

    assert_eq!(stats.words, 6);
    assert_eq!(stats.sentences, 3);
    assert_eq!(stats.characters, text.encode_utf16().count());
    assert_eq!(stats.reading_minutes, 1);
    assert!((stats.words_per_sentence - 2.0).abs() < 1e-9);
}

#[test]
fn empty_and_code_only_documents_have_zero_stats() {
    for text in ["", "```\nlet x = 1;\n```\n"] {
        let analysis = analyze(text);
        assert_eq!(analysis.issues, vec![]);
        let stats = analysis.stats;
        assert_eq!(stats.words, 0);
        assert_eq!(stats.characters, text.encode_utf16().count());
        for value in [
            stats.ari,
            stats.flesch_kincaid,
            stats.coleman_liau,
            stats.words_per_sentence,
        ] {
            assert_eq!(value, 0.0);
        }
    }
}

#[test]
fn cached_analysis_matches_a_fresh_analysis() {
    let original = sample_document(4);
    let edited = original.replacen("quietly", "silently", 1);
    assert_ne!(original, edited);

    analyze(&original);
    let cached = analyze(&edited);
    let fresh = Analyzer::new(Vec::<String>::new()).analyze(&edited);

    assert_eq!(cached, fresh);
}

#[test]
#[ignore = "slow in debug builds; run with `cargo test --release -- --ignored`"]
fn analyzes_five_thousand_words_quickly() {
    let text = sample_document(32);
    let mut analyzer = Analyzer::new(Vec::<String>::new());

    let started = Instant::now();
    let analysis = analyzer.analyze(&text);
    let cold = started.elapsed();

    let edited = text.replacen("quietly", "silently", 1);
    let started = Instant::now();
    analyzer.analyze(&edited);
    let warm = started.elapsed();

    println!(
        "{} words, {} issues: cold {cold:?}, after one edit {warm:?}",
        analysis.stats.words,
        analysis.issues.len()
    );
    assert!((4_500..6_000).contains(&analysis.stats.words));
    assert!(cold.as_millis() < 100, "cold analysis took {cold:?}");
    assert!(warm.as_millis() < 20, "warm analysis took {warm:?}");
}

/// Gives a realistic Markdown document with `sections` sections of about 155 words each.
fn sample_document(sections: usize) -> String {
    let mut text = String::from("---\ntitle: Field notes\ntags: [draft]\n---\n\n");
    for n in 1..=sections {
        text.push_str(&format!(
            "## Day {n}: the river\n\n\
             We left camp at dawn on day {n}, and the fog was still thick over the water. \
             The guide walked quietly ahead of us, and he stopped often to listen. \
             It is important to note that the trail was utilized by hunters in order to reach the northern ridge, \
             which was described in the old maps as a dangerous and largely impassable stretch of country.\n\n\
             > The river does not care about your schedule, said the guide on day {n}.\n\n\
             - Pack {n} extra pairs of socks.\n\
             - Check the `stove.fuel` level before you leave.\n\
             - Read [the permit rules](https://example.com/permits/{n}) again.\n\n\
             ```sh\nrsync -av notes/ backup/day-{n}/\n```\n\n\
             By the evening we had covered about {n} miles. The cook made a very simple soup, \
             and we ate it slowly by the fire while teh wind moved through the pines. \
             Their are worse ways to end a long day, and nobody complained about the cold.\n\n"
        ));
    }
    text
}
