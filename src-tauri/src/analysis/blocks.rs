use std::ops::Range;

use pulldown_cmark::{Event, Options, Parser, Tag};

/// A top-level Markdown block that contains prose.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct Block {
    /// The byte range of the block in the document.
    pub range: Range<usize>,
    /// True if the block is a heading.
    pub heading: bool,
}

/// Gives the top-level blocks of `text` that contain prose, in document order.
///
/// Code blocks, HTML blocks, and YAML front matter are not prose. Each block can be analyzed
/// alone, because each block is a full Markdown document.
pub(super) fn prose_blocks(text: &str) -> Vec<Block> {
    let options = Options::all().difference(Options::ENABLE_SMART_PUNCTUATION);
    let mut depth = 0usize;
    let mut blocks = Vec::new();

    for (event, range) in Parser::new_ext(text, options).into_offset_iter() {
        match event {
            Event::Start(tag) => {
                if depth == 0 && is_prose(&tag) {
                    let heading = matches!(tag, Tag::Heading { .. });
                    blocks.push(Block { range, heading });
                }
                depth += 1;
            }
            Event::End(_) => depth -= 1,
            _ => {}
        }
    }

    blocks
}

fn is_prose(tag: &Tag) -> bool {
    !matches!(
        tag,
        Tag::CodeBlock(_) | Tag::HtmlBlock | Tag::MetadataBlock(_)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn block_texts(text: &str) -> Vec<(&str, bool)> {
        prose_blocks(text)
            .into_iter()
            .map(|b| (text[b.range].trim_end(), b.heading))
            .collect()
    }

    #[test]
    fn skips_code_html_and_front_matter() {
        let text = "---\ntitle: x\n---\n\n# Title\n\nSome text.\n\n```\ncode\n```\n\n<div>html</div>\n\n    indented code\n\n> quote\n\n- item\n- item two\n";
        assert_eq!(
            block_texts(text),
            vec![
                ("# Title", true),
                ("Some text.", false),
                ("> quote", false),
                ("- item\n- item two", false),
            ]
        );
    }
}
