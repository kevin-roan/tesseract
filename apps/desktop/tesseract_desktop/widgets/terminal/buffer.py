from collections import deque
from dataclasses import dataclass
from itertools import islice

from .cells import DEFAULT_STYLE, Line, Style


@dataclass
class SavedCursor:
    x: int = 0
    y: int = 0
    style: Style = DEFAULT_STYLE
    origin: bool = False
    autowrap: bool = True
    wrap_pending: bool = False
    charsets: tuple[str, str] = ("B", "B")
    shift: int = 0


class Buffer:
    def __init__(self, cols: int, rows: int, scrollback: int = 0) -> None:
        self.cols = cols
        self.rows = rows
        self.lines = [Line(cols) for _ in range(rows)]
        self.limit = scrollback
        self.scrollback: deque[Line] = deque(maxlen=scrollback)
        self.dropped = 0
        self.pushed = 0
        self.saved: SavedCursor | None = None

    @property
    def keeps_history(self) -> bool:
        return self.limit > 0

    @property
    def history(self) -> int:
        return len(self.scrollback)

    @property
    def first_index(self) -> int:
        return self.dropped

    @property
    def end_index(self) -> int:
        return self.dropped + len(self.scrollback) + self.rows

    def push_history(self, line: Line) -> None:
        if not self.limit:
            return
        if len(self.scrollback) == self.limit:
            self.dropped += 1
        self.scrollback.append(line)
        self.pushed += 1

    def clear_history(self) -> None:
        self.dropped += len(self.scrollback)
        self.scrollback.clear()

    def line_at(self, index: int) -> Line | None:
        offset = index - self.dropped
        if offset < 0:
            return None
        history = len(self.scrollback)
        if offset < history:
            return self.scrollback[offset]
        offset -= history
        return self.lines[offset] if offset < self.rows else None

    def screen_index(self, row: int) -> int:
        return self.dropped + len(self.scrollback) + row

    def visible(self, offset: int) -> list[Line]:
        offset = max(0, min(offset, len(self.scrollback)))
        if offset == 0:
            return list(self.lines)
        start = len(self.scrollback) - offset
        return list(islice(self.scrollback, start, None)) + self.lines[: self.rows - offset]

    def clear(self, style: Style = DEFAULT_STYLE) -> None:
        for line in self.lines:
            line.clear(style)

    def resize(self, cols: int, rows: int, cursor_y: int) -> int:
        if cols != self.cols:
            for line in self.lines:
                line.resize(cols)
        if rows < self.rows:
            excess = self.rows - rows
            below = max(0, self.rows - 1 - cursor_y)
            drop_bottom = min(excess, below)
            if drop_bottom:
                del self.lines[self.rows - drop_bottom:]
            drop_top = excess - drop_bottom
            for line in self.lines[:drop_top]:
                self.push_history(line)
            del self.lines[:drop_top]
            cursor_y -= drop_top
        elif rows > self.rows:
            extra = rows - self.rows
            pulled = min(extra, len(self.scrollback)) if self.limit else 0
            restored = [self.scrollback.pop() for _ in range(pulled)]
            restored.reverse()
            for line in restored:
                line.resize(cols)
            self.pushed = max(0, self.pushed - pulled)
            self.lines[:0] = restored
            self.lines.extend(Line(cols) for _ in range(extra - pulled))
            cursor_y += pulled
        self.cols = cols
        self.rows = rows
        return max(0, min(rows - 1, cursor_y))
