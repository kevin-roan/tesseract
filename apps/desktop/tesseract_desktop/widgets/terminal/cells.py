from typing import NamedTuple

from .width import char_width

DEFAULT_COLOR = -1
TRUECOLOR = 0x1000000

BOLD = 1
DIM = 2
ITALIC = 4
UNDERLINE = 8
BLINK = 16
INVERSE = 32
HIDDEN = 64
STRIKE = 128
DOUBLE_UNDERLINE = 256
OVERLINE = 512

BLANK = " "
WIDE_TAIL = ""


class Style(NamedTuple):
    fg: int = DEFAULT_COLOR
    bg: int = DEFAULT_COLOR
    flags: int = 0

    def erased(self) -> "Style":
        return self if self.fg == DEFAULT_COLOR and self.flags == 0 else Style(DEFAULT_COLOR, self.bg, 0)


DEFAULT_STYLE = Style()


def rgb_color(red: int, green: int, blue: int) -> int:
    return TRUECOLOR | (max(0, min(255, red)) << 16) | (max(0, min(255, green)) << 8) | max(0, min(255, blue))


def is_truecolor(color: int) -> bool:
    return color >= TRUECOLOR


def color_rgb(color: int) -> tuple[int, int, int]:
    return (color >> 16) & 0xFF, (color >> 8) & 0xFF, color & 0xFF


class Line:
    __slots__ = ("chars", "attrs", "wrapped")

    def __init__(self, cols: int, style: Style = DEFAULT_STYLE) -> None:
        self.chars: list[str] = [BLANK] * cols
        self.attrs: list[Style] = [style] * cols
        self.wrapped = False

    @classmethod
    def from_text(cls, text: str, style: Style = DEFAULT_STYLE) -> "Line":
        line = cls(0)
        line.chars = list(text)
        line.attrs = [style] * len(text)
        return line

    def __len__(self) -> int:
        return len(self.chars)

    def copy(self) -> "Line":
        line = Line(0)
        line.chars = self.chars[:]
        line.attrs = self.attrs[:]
        line.wrapped = self.wrapped
        return line

    def clear(self, style: Style = DEFAULT_STYLE) -> None:
        cols = len(self.chars)
        self.chars[:] = [BLANK] * cols
        self.attrs[:] = [style] * cols
        self.wrapped = False

    def fill(self, start: int, end: int, style: Style = DEFAULT_STYLE, char: str = BLANK) -> None:
        start = max(0, start)
        end = min(len(self.chars), end)
        if end <= start:
            return
        self._split_wide(start)
        self._split_wide(end)
        self.chars[start:end] = [char] * (end - start)
        self.attrs[start:end] = [style] * (end - start)

    def resize(self, cols: int, style: Style = DEFAULT_STYLE) -> None:
        current = len(self.chars)
        if cols < current:
            del self.chars[cols:]
            del self.attrs[cols:]
            if cols and self.chars[cols - 1] != WIDE_TAIL and _is_wide_head(self, cols - 1):
                self.chars[cols - 1] = BLANK
        elif cols > current:
            self.chars.extend([BLANK] * (cols - current))
            self.attrs.extend([style] * (cols - current))

    def insert(self, at: int, count: int, style: Style) -> None:
        cols = len(self.chars)
        if at >= cols or count <= 0:
            return
        count = min(count, cols - at)
        self._split_wide(at)
        self.chars[at:at] = [BLANK] * count
        self.attrs[at:at] = [style] * count
        del self.chars[cols:]
        del self.attrs[cols:]
        self._repair_tail()

    def delete(self, at: int, count: int, style: Style) -> None:
        cols = len(self.chars)
        if at >= cols or count <= 0:
            return
        count = min(count, cols - at)
        self._split_wide(at)
        self._split_wide(at + count)
        del self.chars[at:at + count]
        del self.attrs[at:at + count]
        self.chars.extend([BLANK] * count)
        self.attrs.extend([style] * count)

    def text(self, start: int = 0, end: int | None = None) -> str:
        return "".join(self.chars[start:end])

    def trimmed_length(self) -> int:
        length = len(self.chars)
        while length > 0 and self.chars[length - 1] in (BLANK, WIDE_TAIL):
            length -= 1
        return length

    def _split_wide(self, at: int) -> None:
        if 0 < at < len(self.chars) and self.chars[at] == WIDE_TAIL:
            self.chars[at - 1] = BLANK
            self.chars[at] = BLANK

    def _repair_tail(self) -> None:
        last = len(self.chars) - 1
        if last >= 0 and _is_wide_head(self, last):
            self.chars[last] = BLANK


def _is_wide_head(line: Line, index: int) -> bool:
    char = line.chars[index]
    return bool(char) and char != BLANK and char_width(char[0]) == 2
