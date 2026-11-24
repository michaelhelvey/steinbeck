use std::borrow::Cow;

use harper_core::Span;

use super::offsets::Utf16Map;
use super::{Fix, IssueKind};

/// An issue in one block, with UTF-16 offsets relative to the block start.
#[derive(Debug, Clone)]
pub(super) struct Finding {
    pub kind: IssueKind,
    pub from: usize,
    pub to: usize,
    pub message: Cow<'static, str>,
    pub fixes: Vec<Fix>,
    /// A stable hash of the text in the range.
    pub text_hash: u64,
}

impl Finding {
    /// Changes each offset of the finding and its fixes with `change`.
    pub(super) fn move_offsets(&mut self, change: impl Fn(usize) -> usize) {
        self.from = change(self.from);
        self.to = change(self.to);
        for fix in &mut self.fixes {
            fix.from = change(fix.from);
            fix.to = change(fix.to);
        }
    }
}

/// The text of one block, which makes findings with UTF-16 offsets.
pub(super) struct BlockText<'a> {
    chars: &'a [char],
    map: Utf16Map,
}

impl<'a> BlockText<'a> {
    pub(super) fn new(chars: &'a [char]) -> Self {
        Self {
            chars,
            map: Utf16Map::new(chars),
        }
    }

    /// Makes a finding for the `char` span `span`.
    pub(super) fn finding(
        &self,
        kind: IssueKind,
        span: Span<char>,
        message: impl Into<Cow<'static, str>>,
        fixes: Vec<Fix>,
    ) -> Finding {
        Finding {
            kind,
            from: self.map.at(span.start),
            to: self.map.at(span.end),
            message: message.into(),
            fixes,
            text_hash: fnv1a(span.get_content(self.chars)),
        }
    }

    /// Makes a fix that replaces `span` with `insert`. The label is `label`.
    pub(super) fn replace(&self, span: Span<char>, label: &str, insert: &str) -> Fix {
        Fix {
            label: label.to_owned(),
            from: self.map.at(span.start),
            to: self.map.at(span.end),
            insert: insert.to_owned(),
        }
    }

    /// Makes a fix that removes `span` and one space next to it.
    ///
    /// The fix removes the space after the span if there is one. If not, it removes the space
    /// before the span if there is one.
    pub(super) fn cut(&self, span: Span<char>) -> Fix {
        let is_space = |i: usize| self.chars.get(i) == Some(&' ');
        let span = if is_space(span.end) {
            Span::new(span.start, span.end + 1)
        } else if span.start > 0 && is_space(span.start - 1) {
            Span::new(span.start - 1, span.end)
        } else {
            span
        };
        self.replace(span, "cut", "")
    }

    /// Gives the text of `span`.
    pub(super) fn text(&self, span: Span<char>) -> String {
        span.get_content(self.chars).iter().collect()
    }
}

/// Gives the FNV-1a hash of `chars`. The value is stable across builds and platforms.
pub(super) fn fnv1a(chars: &[char]) -> u64 {
    chars.iter().fold(0xcbf2_9ce4_8422_2325, |hash, c| {
        (hash ^ u64::from(*c)).wrapping_mul(0x0000_0100_0000_01b3)
    })
}
