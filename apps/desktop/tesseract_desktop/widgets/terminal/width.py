import unicodedata
from functools import lru_cache

ZERO_WIDTH_CATEGORIES = frozenset(("Mn", "Me", "Cf"))
WIDE = frozenset(("W", "F"))
HANGUL_JAMO_MEDIAL = (0x1160, 0x11FF)
ZERO_WIDTH_SPACE = 0x200B
SOFT_HYPHEN = 0x00AD


@lru_cache(maxsize=8192)
def char_width(char: str) -> int:
    code = ord(char)
    if 0x20 <= code < 0x7F:
        return 1
    if code < 0x20 or 0x7F <= code < 0xA0:
        return 0
    if code == SOFT_HYPHEN:
        return 1
    if code == ZERO_WIDTH_SPACE or HANGUL_JAMO_MEDIAL[0] <= code <= HANGUL_JAMO_MEDIAL[1]:
        return 0
    if unicodedata.category(char) in ZERO_WIDTH_CATEGORIES:
        return 0
    return 2 if unicodedata.east_asian_width(char) in WIDE else 1


def text_width(text: str) -> int:
    return sum(char_width(char) for char in text)
