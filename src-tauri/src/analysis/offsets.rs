/// Converts `char` indices of a text into UTF-16 code unit offsets.
///
/// Harper gives spans as `char` indices. The editor uses UTF-16 code units.
pub(super) struct Utf16Map {
    prefix: Vec<usize>,
}

impl Utf16Map {
    /// Makes the map for `chars`.
    pub(super) fn new(chars: &[char]) -> Self {
        let mut prefix = Vec::with_capacity(chars.len() + 1);
        let mut offset = 0;
        prefix.push(offset);
        for c in chars {
            offset += c.len_utf16();
            prefix.push(offset);
        }
        Self { prefix }
    }

    /// Gives the UTF-16 offset of the `char` index `index`.
    pub(super) fn at(&self, index: usize) -> usize {
        self.prefix[index]
    }
}

/// Converts ascending byte offsets of a `str` into UTF-16 offsets in one pass.
pub(super) struct Utf16Cursor<'a> {
    text: &'a str,
    byte: usize,
    utf16: usize,
}

impl<'a> Utf16Cursor<'a> {
    /// Makes a cursor at the start of `text`.
    pub(super) fn new(text: &'a str) -> Self {
        Self {
            text,
            byte: 0,
            utf16: 0,
        }
    }

    /// Gives the UTF-16 offset of `byte`. The value of `byte` must not be less than the value
    /// of the last call.
    pub(super) fn advance_to(&mut self, byte: usize) -> usize {
        assert!(byte >= self.byte, "byte offsets must ascend");
        self.utf16 += self.text[self.byte..byte].encode_utf16().count();
        self.byte = byte;
        self.utf16
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn map_counts_surrogate_pairs_as_two_units() {
        let chars: Vec<char> = "a😀“b”".chars().collect();
        let map = Utf16Map::new(&chars);
        let expected: Vec<usize> = vec![0, 1, 3, 4, 5, 6];
        let actual: Vec<usize> = (0..=chars.len()).map(|i| map.at(i)).collect();
        assert_eq!(actual, expected);
    }

    #[test]
    fn cursor_matches_encode_utf16() {
        let text = "😀 — “quote” 😀 end";
        let mut cursor = Utf16Cursor::new(text);
        for (byte, _) in text.char_indices() {
            assert_eq!(cursor.advance_to(byte), text[..byte].encode_utf16().count());
        }
    }
}
