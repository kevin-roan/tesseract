from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

from .cells import BLANK, WIDE_TAIL, Line

SelectionMode = Literal["char", "word", "line"]
Point = tuple[int, int]

WORD_PUNCTUATION = frozenset("-#%&+,./=?@\\_~:")


def is_word_char(char: str) -> bool:
    return bool(char) and char != BLANK and (char[0].isalnum() or char[0] in WORD_PUNCTUATION or ord(char[0]) > 0x2E7F)


@dataclass
class Selection:
    anchor: Point
    head: Point
    mode: SelectionMode = "char"

    def ordered(self) -> tuple[Point, Point]:
        return (self.anchor, self.head) if self.anchor <= self.head else (self.head, self.anchor)


LineLookup = Callable[[int], Line | None]


def _word_bounds(line: Line | None, col: int) -> tuple[int, int]:
    if line is None or not line.chars:
        return col, col
    col = max(0, min(col, len(line.chars) - 1))
    if line.chars[col] == WIDE_TAIL and col > 0:
        col -= 1
    chars = line.chars
    if not is_word_char(chars[col]):
        end = col + 1
        while end < len(chars) and chars[end] == WIDE_TAIL:
            end += 1
        return col, end
    start = col
    while start > 0 and (is_word_char(chars[start - 1]) or chars[start - 1] == WIDE_TAIL):
        start -= 1
    end = col + 1
    while end < len(chars) and (is_word_char(chars[end]) or chars[end] == WIDE_TAIL):
        end += 1
    return start, end


def selection_range(selection: Selection, lookup: LineLookup, cols: int) -> tuple[Point, Point] | None:
    start, end = selection.ordered()
    if selection.mode == "line":
        return (start[0], 0), (end[0], cols)
    if selection.mode == "word":
        first, _ = _word_bounds(lookup(start[0]), start[1])
        _, last = _word_bounds(lookup(end[0]), end[1])
        return (start[0], first), (end[0], last)
    if start == end:
        return None
    return start, end


def row_span(bounds: tuple[Point, Point] | None, row: int, cols: int) -> tuple[int, int] | None:
    if bounds is None:
        return None
    (start_row, start_col), (end_row, end_col) = bounds
    if row < start_row or row > end_row:
        return None
    first = start_col if row == start_row else 0
    last = end_col if row == end_row else cols
    return (first, last) if last > first else None


def selected_text(bounds: tuple[Point, Point] | None, lookup: LineLookup, cols: int) -> str:
    if bounds is None:
        return ""
    (start_row, _), (end_row, _) = bounds
    parts: list[str] = []
    for row in range(start_row, end_row + 1):
        line = lookup(row)
        span = row_span(bounds, row, cols)
        if line is None or span is None:
            if row < end_row:
                parts.append("\n")
            continue
        first, last = span
        chunk = "".join(char for char in line.chars[first:last] if char != WIDE_TAIL)
        continues = line.wrapped and last >= len(line.chars)
        if not continues:
            chunk = chunk.rstrip(BLANK)
        parts.append(chunk)
        if row < end_row and not continues:
            parts.append("\n")
    return "".join(parts)
