use harper_core::{Document, Span, TokenKind, TokenStringExt};

/// A word in a sentence.
pub(super) struct Word<'a> {
    /// The `char` span of the word in the source.
    pub span: Span<char>,
    /// The word in lowercase, with straight apostrophes.
    pub lower: String,
    /// True if only spaces are between the previous word and this word.
    pub joined: bool,
    /// The Harper token kind of the word.
    pub kind: &'a TokenKind,
}

/// A sentence that contains at least one word.
pub(super) struct Sentence<'a> {
    /// The `char` span from the first to the last visible token of the sentence.
    pub span: Span<char>,
    pub words: Vec<Word<'a>>,
}

/// Gives the sentences of `document` that contain words.
pub(super) fn sentences(document: &Document) -> Vec<Sentence<'_>> {
    let source = document.get_source();

    document
        .iter_sentences()
        .filter_map(|tokens| {
            let mut words = Vec::new();
            let mut joined = false;

            for token in tokens {
                match &token.kind {
                    TokenKind::Word(_) => {
                        let lower = token
                            .span
                            .get_content(source)
                            .iter()
                            .flat_map(|c| c.to_lowercase())
                            .map(|c| if c == '’' { '\'' } else { c })
                            .collect();
                        words.push(Word {
                            span: token.span,
                            lower,
                            joined,
                            kind: &token.kind,
                        });
                        joined = true;
                    }
                    TokenKind::Space(_) => {}
                    _ => joined = false,
                }
            }

            let mut visible = tokens.iter().filter(|t| is_visible(&t.kind));
            let first = visible.next()?;
            let last = visible.next_back().unwrap_or(first);

            (!words.is_empty()).then(|| Sentence {
                span: Span::new(first.span.start, last.span.end),
                words,
            })
        })
        .collect()
}

fn is_visible(kind: &TokenKind) -> bool {
    !matches!(
        kind,
        TokenKind::Space(_)
            | TokenKind::Newline(_)
            | TokenKind::ParagraphBreak
            | TokenKind::HeadingStart
            | TokenKind::Unlintable
    )
}
