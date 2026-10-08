import codecs
from collections.abc import Callable
from types import MappingProxyType
from typing import Literal

from .buffer import Buffer, SavedCursor
from .cells import (
    BLINK,
    BOLD,
    DEFAULT_COLOR,
    DEFAULT_STYLE,
    DIM,
    DOUBLE_UNDERLINE,
    HIDDEN,
    INVERSE,
    ITALIC,
    OVERLINE,
    STRIKE,
    UNDERLINE,
    WIDE_TAIL,
    Line,
    Style,
    rgb_color,
)
from .palette import TerminalPalette, palette_for
from .parser import BEL, ESC, Parser, int_params, parse_params
from .width import char_width

CursorShape = Literal["block", "underline", "bar"]

DEFAULT_SCROLLBACK = 5000
TAB_WIDTH = 8
MIN_COLS = 2
MIN_ROWS = 1
MAX_COLS = 1000
MAX_ROWS = 500
ST = ESC + "\\"
CSI = ESC + "["

DA1_REPLY = CSI + "?62;22c"
DA2_REPLY = CSI + ">1;10;0c"
XTVERSION_REPLY = ESC + "P>|Tesseract(1.0)" + ST

MOUSE_X10 = 9
MOUSE_NORMAL = 1000
MOUSE_BUTTON = 1002
MOUSE_ANY = 1003

DEC_GRAPHICS = MappingProxyType({
    "_": " ", "`": "◆", "a": "▒", "b": "␉", "c": "␌", "d": "␍", "e": "␊", "f": "°", "g": "±", "h": "␤",
    "i": "␋", "j": "┘", "k": "┐", "l": "┌", "m": "└", "n": "┼", "o": "⎺", "p": "⎻", "q": "─", "r": "⎼",
    "s": "⎽", "t": "├", "u": "┤", "v": "┴", "w": "┬", "x": "│", "y": "≤", "z": "≥", "{": "π", "|": "≠",
    "}": "£", "~": "·",
})
DEC_TABLE = str.maketrans(dict(DEC_GRAPHICS))

CURSOR_STYLES: MappingProxyType[int, tuple[CursorShape, bool]] = MappingProxyType({
    0: ("block", True), 1: ("block", True), 2: ("block", False), 3: ("underline", True),
    4: ("underline", False), 5: ("bar", True), 6: ("bar", False),
})

SGR_FLAGS_ON = MappingProxyType({
    1: BOLD, 2: DIM, 3: ITALIC, 4: UNDERLINE, 5: BLINK, 6: BLINK, 7: INVERSE, 8: HIDDEN, 9: STRIKE,
    21: DOUBLE_UNDERLINE, 53: OVERLINE,
})
SGR_FLAGS_OFF = MappingProxyType({
    22: BOLD | DIM, 23: ITALIC, 24: UNDERLINE | DOUBLE_UNDERLINE, 25: BLINK, 27: INVERSE, 28: HIDDEN,
    29: STRIKE, 55: OVERLINE,
})


def _osc_color(rgb: tuple[int, int, int]) -> str:
    return "rgb:" + "/".join(f"{value:02x}{value:02x}" for value in rgb)


class Terminal:
    def __init__(
        self,
        cols: int = 80,
        rows: int = 24,
        scrollback: int = DEFAULT_SCROLLBACK,
        on_reply: Callable[[str], None] | None = None,
        on_title: Callable[[str], None] | None = None,
        on_bell: Callable[[], None] | None = None,
        palette: TerminalPalette | None = None,
    ) -> None:
        self.cols = max(MIN_COLS, min(MAX_COLS, cols))
        self.rows = max(MIN_ROWS, min(MAX_ROWS, rows))
        self.scrollback_limit = scrollback
        self.on_reply = on_reply
        self.on_title = on_title
        self.on_bell = on_bell
        self.palette = palette or palette_for("dark")
        self.cell_pixels: tuple[int, int] = (8, 16)
        self._parser = Parser(self)
        self._decoder = codecs.getincrementaldecoder("utf-8")("replace")
        self.generation = 0
        self._init_state()

    def _init_state(self) -> None:
        self.primary = Buffer(self.cols, self.rows, self.scrollback_limit)
        self.alternate = Buffer(self.cols, self.rows, 0)
        self.buffer = self.primary
        self.title = ""
        self.cwd = ""
        self._reset_modes()
        self.cursor_visible = True
        self.cursor_shape: CursorShape = "block"
        self.cursor_blink = False
        self.tabs = set(range(0, self.cols, TAB_WIDTH))
        self.last_char = ""

    def _reset_modes(self) -> None:
        self.x = 0
        self.y = 0
        self.wrap_pending = False
        self.style = DEFAULT_STYLE
        self.top = 0
        self.bottom = self.rows - 1
        self.origin = False
        self.autowrap = True
        self.insert_mode = False
        self.newline_mode = False
        self.app_cursor = False
        self.app_keypad = False
        self.reverse_video = False
        self.bracketed_paste = False
        self.focus_events = False
        self.mouse_mode = 0
        self.mouse_sgr = False
        self.alternate_scroll = True
        self.synchronized = False
        self.charsets = ["B", "B"]
        self.shift = 0

    @property
    def alt_screen(self) -> bool:
        return self.buffer is self.alternate

    @property
    def lines(self) -> list[Line]:
        return self.buffer.lines

    def feed(self, data: str) -> None:
        if data:
            self._parser.feed(data)
            self.generation += 1

    def feed_bytes(self, data: bytes) -> None:
        self.feed(self._decoder.decode(data))

    def reset(self, clear_history: bool = True) -> None:
        history = None if clear_history else self.primary
        self._parser.reset()
        self._decoder.reset()
        self._init_state()
        if history is not None:
            history.clear()
            history.saved = None
            self.primary = history
            self.buffer = history
        self.generation += 1

    def resize(self, cols: int, rows: int) -> None:
        cols = max(MIN_COLS, min(MAX_COLS, cols))
        rows = max(MIN_ROWS, min(MAX_ROWS, rows))
        if cols == self.cols and rows == self.rows:
            return
        for buffer in (self.primary, self.alternate):
            if buffer is self.buffer:
                self.y = buffer.resize(cols, rows, self.y)
            else:
                saved = buffer.saved
                y = buffer.resize(cols, rows, saved.y if saved else buffer.rows - 1)
                if saved:
                    saved.y = y
        old_cols = self.cols
        self.cols = cols
        self.rows = rows
        self.tabs = {tab for tab in self.tabs if tab < cols} | set(range(old_cols + (-old_cols % TAB_WIDTH), cols, TAB_WIDTH))
        self.top = 0
        self.bottom = rows - 1
        self.x = min(self.x, cols - 1)
        self.y = min(self.y, rows - 1)
        self.wrap_pending = False
        self.generation += 1

    def clear_history(self) -> None:
        self.primary.clear_history()
        self.generation += 1

    def clear_to_cursor_line(self) -> None:
        buffer = self.buffer
        if self.y:
            kept = buffer.lines[self.y:]
            buffer.lines[:] = kept + [Line(self.cols) for _ in range(self.y)]
            self.y = 0
        for line in buffer.lines[1:]:
            line.clear()
        self.clear_history()

    def text(self) -> str:
        return "\n".join(line.text().rstrip() for line in self.buffer.lines).rstrip("\n")

    def _reply(self, data: str) -> None:
        if self.on_reply:
            self.on_reply(data)

    def print(self, text: str) -> None:
        if self.charsets[self.shift] == "0":
            text = text.translate(DEC_TABLE)
        if text.isascii():
            self._print_ascii(text)
        else:
            self._print_unicode(text)
        self.last_char = text[-1]

    def _print_ascii(self, text: str) -> None:
        cols = self.cols
        style = self.style
        index = 0
        size = len(text)
        while index < size:
            if self.wrap_pending:
                self._wrap()
            line = self.buffer.lines[self.y]
            x = self.x
            chunk = text[index:index + cols - x]
            count = len(chunk)
            if self.insert_mode:
                line.insert(x, count, style)
            line._split_wide(x)
            line._split_wide(x + count)
            line.chars[x:x + count] = chunk
            line.attrs[x:x + count] = [style] * count
            index += count
            if x + count >= cols:
                self.x = cols - 1
                if self.autowrap:
                    self.wrap_pending = True
                elif index < size:
                    line.chars[cols - 1] = text[-1]
                    return
            else:
                self.x = x + count

    def _print_unicode(self, text: str) -> None:
        cols = self.cols
        style = self.style
        for char in text:
            code = ord(char)
            if 0x7F <= code < 0xA0:
                continue
            width = char_width(char)
            if width == 0:
                self._combine(char)
                continue
            if self.wrap_pending:
                self._wrap()
            if width == 2 and self.x == cols - 1:
                if cols < 2:
                    continue
                if self.autowrap:
                    self.buffer.lines[self.y].fill(self.x, cols, style)
                    self._wrap()
                else:
                    self.x = cols - 2
            line = self.buffer.lines[self.y]
            x = self.x
            if self.insert_mode:
                line.insert(x, width, style)
            line._split_wide(x)
            line._split_wide(x + width)
            line.chars[x] = char
            line.attrs[x] = style
            if width == 2:
                line.chars[x + 1] = WIDE_TAIL
                line.attrs[x + 1] = style
            if x + width >= cols:
                self.x = cols - 1
                self.wrap_pending = self.autowrap
            else:
                self.x = x + width

    def _combine(self, char: str) -> None:
        line = self.buffer.lines[self.y]
        x = self.x if self.wrap_pending else self.x - 1
        if x < 0:
            return
        if line.chars[x] == WIDE_TAIL and x > 0:
            x -= 1
        if line.chars[x] != WIDE_TAIL:
            line.chars[x] += char

    def _wrap(self) -> None:
        self.buffer.lines[self.y].wrapped = True
        self.x = 0
        self.wrap_pending = False
        self._index()

    def _index(self) -> None:
        if self.y == self.bottom:
            self._scroll_up(1)
        elif self.y < self.rows - 1:
            self.y += 1

    def _reverse_index(self) -> None:
        if self.y == self.top:
            self._scroll_down(1)
        elif self.y > 0:
            self.y -= 1

    def _blank_style(self) -> Style:
        return self.style.erased()

    def _scroll_up(self, count: int) -> None:
        top, bottom = self.top, self.bottom
        count = min(count, bottom - top + 1)
        if count <= 0:
            return
        buffer = self.buffer
        lines = buffer.lines
        style = self._blank_style()
        blanks = [Line(self.cols, style) for _ in range(count)]
        if top == 0 and bottom == self.rows - 1 and buffer.keeps_history:
            for line in lines[:count]:
                buffer.push_history(line)
        del lines[top:top + count]
        lines[bottom - count + 1:bottom - count + 1] = blanks

    def _scroll_down(self, count: int) -> None:
        top, bottom = self.top, self.bottom
        count = min(count, bottom - top + 1)
        if count <= 0:
            return
        lines = self.buffer.lines
        style = self._blank_style()
        del lines[bottom - count + 1:bottom + 1]
        lines[top:top] = [Line(self.cols, style) for _ in range(count)]

    def execute(self, control: str) -> None:
        if control == "\r":
            self.x = 0
            self.wrap_pending = False
        elif control in "\n\x0b\x0c":
            self._index()
            if self.newline_mode:
                self.x = 0
            self.wrap_pending = False
        elif control == "\x08":
            self.wrap_pending = False
            if self.x > 0:
                self.x -= 1
        elif control == "\t":
            self._tab(1)
        elif control == BEL:
            if self.on_bell:
                self.on_bell()
        elif control == "\x0e":
            self.shift = 1
        elif control == "\x0f":
            self.shift = 0

    def _tab(self, count: int) -> None:
        x = self.x
        for _ in range(count):
            following = [tab for tab in self.tabs if tab > x]
            x = min(following) if following else self.cols - 1
        self.x = min(x, self.cols - 1)

    def _back_tab(self, count: int) -> None:
        x = self.x
        for _ in range(count):
            previous = [tab for tab in self.tabs if tab < x]
            x = max(previous) if previous else 0
        self.x = x
        self.wrap_pending = False

    def esc_dispatch(self, intermediates: str, final: str) -> None:
        if intermediates:
            if intermediates in ("(", ")"):
                self.charsets[0 if intermediates == "(" else 1] = final
            elif intermediates == "#" and final == "8":
                self._alignment_test()
            return
        if final == "7":
            self._save_cursor()
        elif final == "8":
            self._restore_cursor()
        elif final == "D":
            self._index()
            self.wrap_pending = False
        elif final == "E":
            self._index()
            self.x = 0
            self.wrap_pending = False
        elif final == "M":
            self._reverse_index()
            self.wrap_pending = False
        elif final == "H":
            self.tabs.add(self.x)
        elif final == "c":
            self.reset(clear_history=False)
        elif final == "=":
            self.app_keypad = True
        elif final == ">":
            self.app_keypad = False

    def _alignment_test(self) -> None:
        for line in self.buffer.lines:
            line.fill(0, self.cols, DEFAULT_STYLE, "E")
            line.wrapped = False
        self.top, self.bottom = 0, self.rows - 1
        self._move_to(0, 0)

    def _save_cursor(self) -> None:
        self.buffer.saved = SavedCursor(
            self.x, self.y, self.style, self.origin, self.autowrap, self.wrap_pending,
            (self.charsets[0], self.charsets[1]), self.shift,
        )

    def _restore_cursor(self) -> None:
        saved = self.buffer.saved or SavedCursor()
        self.x = min(saved.x, self.cols - 1)
        self.y = min(saved.y, self.rows - 1)
        self.style = saved.style
        self.origin = saved.origin
        self.autowrap = saved.autowrap
        self.wrap_pending = saved.wrap_pending and self.x == self.cols - 1
        self.charsets = list(saved.charsets)
        self.shift = saved.shift

    def _move_to(self, x: int, y: int) -> None:
        if self.origin:
            y = max(self.top, min(self.bottom, y + self.top))
        else:
            y = max(0, min(self.rows - 1, y))
        self.x = max(0, min(self.cols - 1, x))
        self.y = y
        self.wrap_pending = False

    def _set_row(self, y: int) -> None:
        self._move_to(self.x, y)

    def osc_dispatch(self, data: str, terminator: str) -> None:
        command, _, rest = data.partition(";")
        if command in ("0", "2"):
            self.title = rest
            if self.on_title:
                self.on_title(rest)
        elif command == "7":
            self.cwd = rest
        elif command in ("10", "11", "12") and rest == "?":
            palette = self.palette
            rgb = {"10": palette.fg_rgb, "11": palette.bg_rgb, "12": palette.cursor_rgb}[command]
            self._reply(f"{ESC}]{command};{_osc_color(rgb)}{terminator}")
        elif command == "4":
            parts = rest.split(";")
            for index, spec in zip(parts[::2], parts[1::2]):
                if spec == "?" and index.isdigit() and int(index) < 256:
                    rgb = self.palette.table[int(index)]
                    self._reply(f"{ESC}]4;{index};{_osc_color(rgb)}{terminator}")

    def csi_dispatch(self, private: str, params: str, intermediates: str, final: str) -> None:
        if intermediates:
            self._csi_intermediate(private, params, intermediates, final)
            return
        if private == "?":
            self._csi_private(params, final)
            return
        if private:
            if private == ">" and final == "c":
                self._reply(DA2_REPLY)
            elif private == ">" and final == "q":
                self._reply(XTVERSION_REPLY)
            return
        if final == "m":
            self._sgr(params)
            return
        values = int_params(params)
        first = values[0] if values else 0
        count = first or 1
        if final == "H" or final == "f":
            row = values[0] if values else 0
            col = values[1] if len(values) > 1 else 0
            self._move_to((col or 1) - 1, (row or 1) - 1)
        elif final == "A":
            floor = self.top if self.y >= self.top else 0
            self.y = max(floor, self.y - count)
            self.wrap_pending = False
        elif final == "B" or final == "e":
            ceiling = self.bottom if self.y <= self.bottom else self.rows - 1
            self.y = min(ceiling, self.y + count)
            self.wrap_pending = False
        elif final == "C" or final == "a":
            self.x = min(self.cols - 1, self.x + count)
            self.wrap_pending = False
        elif final == "D":
            self.x = max(0, self.x - count)
            self.wrap_pending = False
        elif final == "E":
            ceiling = self.bottom if self.y <= self.bottom else self.rows - 1
            self.y = min(ceiling, self.y + count)
            self.x = 0
            self.wrap_pending = False
        elif final == "F":
            floor = self.top if self.y >= self.top else 0
            self.y = max(floor, self.y - count)
            self.x = 0
            self.wrap_pending = False
        elif final == "G" or final == "`":
            self.x = min(self.cols - 1, count - 1)
            self.wrap_pending = False
        elif final == "d":
            self._set_row(count - 1)
        elif final == "J":
            self._erase_display(first)
        elif final == "K":
            self._erase_line(first)
        elif final == "X":
            self.buffer.lines[self.y].fill(self.x, self.x + count, self._blank_style())
            self.wrap_pending = False
        elif final == "P":
            self.buffer.lines[self.y].delete(self.x, count, self._blank_style())
            self.wrap_pending = False
        elif final == "@":
            self.buffer.lines[self.y].insert(self.x, count, self._blank_style())
            self.wrap_pending = False
        elif final == "L":
            self._insert_lines(count)
        elif final == "M":
            self._delete_lines(count)
        elif final == "S":
            self._scroll_up(count)
        elif final == "T":
            self._scroll_down(count)
        elif final == "I":
            self._tab(count)
        elif final == "Z":
            self._back_tab(count)
        elif final == "b":
            if self.last_char:
                self.print(self.last_char * min(count, self.cols * self.rows))
        elif final == "g":
            if first == 0:
                self.tabs.discard(self.x)
            elif first == 3:
                self.tabs.clear()
        elif final == "r":
            self._set_margins(values)
        elif final == "s":
            self._save_cursor()
        elif final == "u":
            self._restore_cursor()
        elif final == "h" or final == "l":
            for mode in values:
                self._set_ansi_mode(mode, final == "h")
        elif final == "n":
            self._device_status(first, "")
        elif final == "c":
            if first == 0:
                self._reply(DA1_REPLY)
        elif final == "t":
            self._window_ops(first)

    def _csi_intermediate(self, private: str, params: str, intermediates: str, final: str) -> None:
        values = int_params(params)
        first = values[0] if values else 0
        if intermediates == " " and final == "q" and not private:
            shape, blink = CURSOR_STYLES.get(first, ("block", True))
            self.cursor_shape = shape
            self.cursor_blink = blink
        elif intermediates == "!" and final == "p":
            self._soft_reset()
        elif intermediates == "$" and final == "p":
            self._report_mode(first, private == "?")

    def _csi_private(self, params: str, final: str) -> None:
        values = int_params(params)
        if final == "h" or final == "l":
            for mode in values:
                self._set_dec_mode(mode, final == "h")
        elif final == "n":
            self._device_status(values[0] if values else 0, "?")
        elif final == "J":
            self._erase_display(values[0] if values else 0)
        elif final == "K":
            self._erase_line(values[0] if values else 0)

    def _device_status(self, code: int, private: str) -> None:
        if code == 5 and not private:
            self._reply(CSI + "0n")
        elif code == 6:
            row = self.y - self.top if self.origin else self.y
            self._reply(f"{CSI}{private}{row + 1};{self.x + 1}R")

    def _window_ops(self, code: int) -> None:
        cell_w, cell_h = self.cell_pixels
        if code == 18:
            self._reply(f"{CSI}8;{self.rows};{self.cols}t")
        elif code == 14:
            self._reply(f"{CSI}4;{self.rows * cell_h};{self.cols * cell_w}t")
        elif code == 16:
            self._reply(f"{CSI}6;{cell_h};{cell_w}t")

    def _erase_display(self, mode: int) -> None:
        lines = self.buffer.lines
        style = self._blank_style()
        if mode == 0:
            self._erase_line(0)
            for line in lines[self.y + 1:]:
                line.clear(style)
        elif mode == 1:
            for line in lines[:self.y]:
                line.clear(style)
            self._erase_line(1)
        elif mode == 2:
            for line in lines:
                line.clear(style)
        elif mode == 3:
            self.clear_history()
        self.wrap_pending = False

    def _erase_line(self, mode: int) -> None:
        line = self.buffer.lines[self.y]
        style = self._blank_style()
        if mode == 0:
            line.fill(self.x, self.cols, style)
            line.wrapped = False
        elif mode == 1:
            line.fill(0, self.x + 1, style)
        elif mode == 2:
            line.clear(style)
        self.wrap_pending = False

    def _insert_lines(self, count: int) -> None:
        if not self.top <= self.y <= self.bottom:
            return
        lines = self.buffer.lines
        count = min(count, self.bottom - self.y + 1)
        style = self._blank_style()
        del lines[self.bottom - count + 1:self.bottom + 1]
        lines[self.y:self.y] = [Line(self.cols, style) for _ in range(count)]
        self.x = 0
        self.wrap_pending = False

    def _delete_lines(self, count: int) -> None:
        if not self.top <= self.y <= self.bottom:
            return
        lines = self.buffer.lines
        count = min(count, self.bottom - self.y + 1)
        style = self._blank_style()
        del lines[self.y:self.y + count]
        lines[self.bottom - count + 1:self.bottom - count + 1] = [Line(self.cols, style) for _ in range(count)]
        self.x = 0
        self.wrap_pending = False

    def _set_margins(self, values: list[int]) -> None:
        top = (values[0] if values and values[0] else 1) - 1
        bottom = (values[1] if len(values) > 1 and values[1] else self.rows) - 1
        bottom = min(bottom, self.rows - 1)
        if top >= bottom:
            return
        self.top, self.bottom = top, bottom
        self._move_to(0, 0)

    def _set_ansi_mode(self, mode: int, enabled: bool) -> None:
        if mode == 4:
            self.insert_mode = enabled
        elif mode == 20:
            self.newline_mode = enabled

    def _set_dec_mode(self, mode: int, enabled: bool) -> None:
        if mode == 1:
            self.app_cursor = enabled
        elif mode == 5:
            self.reverse_video = enabled
        elif mode == 6:
            self.origin = enabled
            self._move_to(0, 0)
        elif mode == 7:
            self.autowrap = enabled
            if not enabled:
                self.wrap_pending = False
        elif mode == 12:
            self.cursor_blink = enabled
        elif mode == 25:
            self.cursor_visible = enabled
        elif mode == 66:
            self.app_keypad = enabled
        elif mode in (MOUSE_X10, MOUSE_NORMAL, MOUSE_BUTTON, MOUSE_ANY):
            self.mouse_mode = mode if enabled else 0
        elif mode == 1006:
            self.mouse_sgr = enabled
        elif mode == 1004:
            self.focus_events = enabled
        elif mode == 1007:
            self.alternate_scroll = enabled
        elif mode == 2004:
            self.bracketed_paste = enabled
        elif mode == 2026:
            self.synchronized = enabled
        elif mode == 1048:
            if enabled:
                self._save_cursor()
            else:
                self._restore_cursor()
        elif mode in (47, 1047, 1049):
            self._switch_screen(mode, enabled)

    def _switch_screen(self, mode: int, enabled: bool) -> None:
        if enabled:
            if mode == 1049:
                self._save_cursor()
            if self.buffer is not self.alternate:
                self.buffer = self.alternate
                if mode != 47:
                    self.alternate.clear(self._blank_style())
        else:
            if self.buffer is self.alternate:
                if mode == 1047:
                    self.alternate.clear(self._blank_style())
                self.buffer = self.primary
            if mode == 1049:
                self._restore_cursor()
        self.top, self.bottom = 0, self.rows - 1
        self.x = min(self.x, self.cols - 1)
        self.y = min(self.y, self.rows - 1)
        self.wrap_pending = False

    def _mode_state(self, mode: int, private: bool) -> int:
        if not private:
            states = {4: self.insert_mode, 20: self.newline_mode}
        else:
            states = {
                1: self.app_cursor, 5: self.reverse_video, 6: self.origin, 7: self.autowrap, 12: self.cursor_blink,
                25: self.cursor_visible, 66: self.app_keypad, MOUSE_X10: self.mouse_mode == MOUSE_X10,
                MOUSE_NORMAL: self.mouse_mode == MOUSE_NORMAL, MOUSE_BUTTON: self.mouse_mode == MOUSE_BUTTON,
                MOUSE_ANY: self.mouse_mode == MOUSE_ANY, 1004: self.focus_events, 1006: self.mouse_sgr,
                1007: self.alternate_scroll, 47: self.alt_screen, 1047: self.alt_screen, 1049: self.alt_screen,
                2004: self.bracketed_paste, 2026: self.synchronized,
            }
        if mode not in states:
            return 0
        return 1 if states[mode] else 2

    def _report_mode(self, mode: int, private: bool) -> None:
        marker = "?" if private else ""
        self._reply(f"{CSI}{marker}{mode};{self._mode_state(mode, private)}$y")

    def _soft_reset(self) -> None:
        self.cursor_visible = True
        self.insert_mode = False
        self.origin = False
        self.autowrap = True
        self.app_cursor = False
        self.app_keypad = False
        self.style = DEFAULT_STYLE
        self.top, self.bottom = 0, self.rows - 1
        self.charsets = ["B", "B"]
        self.shift = 0
        self.wrap_pending = False
        self.buffer.saved = None

    def _sgr(self, params: str) -> None:
        groups = parse_params(params) or [[0]]
        fg, bg, flags = self.style
        index = 0
        total = len(groups)
        while index < total:
            group = groups[index]
            code = group[0] or 0
            index += 1
            if code == 0:
                fg, bg, flags = DEFAULT_COLOR, DEFAULT_COLOR, 0
            elif code == 4 and len(group) > 1:
                flags &= ~(UNDERLINE | DOUBLE_UNDERLINE)
                if group[1] == 2:
                    flags |= DOUBLE_UNDERLINE
                elif group[1]:
                    flags |= UNDERLINE
            elif code in SGR_FLAGS_ON:
                flags |= SGR_FLAGS_ON[code]
            elif code in SGR_FLAGS_OFF:
                flags &= ~SGR_FLAGS_OFF[code]
            elif 30 <= code <= 37:
                fg = code - 30
            elif 40 <= code <= 47:
                bg = code - 40
            elif 90 <= code <= 97:
                fg = code - 90 + 8
            elif 100 <= code <= 107:
                bg = code - 100 + 8
            elif code == 39:
                fg = DEFAULT_COLOR
            elif code == 49:
                bg = DEFAULT_COLOR
            elif code in (38, 48, 58):
                color, index = _extended_color(groups, index, group)
                if color is not None and code == 38:
                    fg = color
                elif color is not None and code == 48:
                    bg = color
        self.style = Style(fg, bg, flags)


def _extended_color(groups: list[list[int | None]], index: int, group: list[int | None]) -> tuple[int | None, int]:
    if len(group) > 1:
        kind = group[1]
        values = [value or 0 for value in group[2:]]
        if kind == 5 and values:
            return min(values[0], 255), index
        if kind == 2 and len(values) >= 3:
            red, green, blue = values[1:4] if len(values) >= 4 else values[:3]
            return rgb_color(red, green, blue), index
        return None, index
    kind = groups[index][0] if index < len(groups) else None
    if kind == 5 and index + 1 < len(groups):
        return min(groups[index + 1][0] or 0, 255), index + 2
    if kind == 2 and index + 3 < len(groups):
        red, green, blue = (groups[index + offset][0] or 0 for offset in (1, 2, 3))
        return rgb_color(red, green, blue), index + 4
    return None, min(len(groups), index + 1)
