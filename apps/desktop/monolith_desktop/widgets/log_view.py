from collections.abc import Iterable, Mapping
from typing import Any

from gi.repository import GLib, Gtk

from ..theme.manager import theme
from ..util.text import clean_log_text
from .buttons import IconButton
from .text import Text

STREAM_COLORS: Mapping[str, str] = {"stdout": "text", "stderr": "danger", "system": "textTertiary"}
DEFAULT_MAX_LINES = 5000
FOLLOW_THRESHOLD_PX = 24


class LogView(Gtk.Overlay):
    def __init__(
        self,
        empty_label: str = "No output yet.",
        jump_label: str = "Jump to latest output",
        max_lines: int = DEFAULT_MAX_LINES,
        min_height: int = 240,
    ) -> None:
        super().__init__(css_classes=["to-log-view"], vexpand=True)
        self.set_overflow(Gtk.Overflow.HIDDEN)
        self._max_lines = max_lines
        self._count = 0
        self._last_seq: int | None = None
        self._following = True
        self._buffer = Gtk.TextBuffer()
        self._tags = {stream: self._buffer.create_tag(stream) for stream in STREAM_COLORS}
        self._apply_tag_colors()
        view = Gtk.TextView(
            buffer=self._buffer,
            editable=False,
            cursor_visible=False,
            monospace=True,
            wrap_mode=Gtk.WrapMode.WORD_CHAR,
        )
        view.add_css_class("to-text-code")
        self._view = view
        self._scroller = Gtk.ScrolledWindow(child=view, vexpand=True, hexpand=True, min_content_height=min_height)
        self.set_child(self._scroller)
        self._empty = Text(empty_label, "caption", "textTertiary")
        self._empty.set_halign(Gtk.Align.START)
        self._empty.set_valign(Gtk.Align.START)
        self._empty.set_margin_top(12)
        self._empty.set_margin_start(12)
        self.add_overlay(self._empty)
        self._jump = IconButton("down", jump_label, self.jump_to_end, flat=False)
        self._jump.add_css_class("to-jump-button")
        self._jump.set_halign(Gtk.Align.END)
        self._jump.set_valign(Gtk.Align.END)
        self._jump.set_margin_end(12)
        self._jump.set_margin_bottom(12)
        self._jump.set_visible(False)
        self.add_overlay(self._jump)
        adjustment = self._scroller.get_vadjustment()
        adjustment.connect("value-changed", self._on_scroll)
        adjustment.connect("changed", self._on_content_changed)
        unsubscribe = theme().subscribe(lambda _scheme: self._apply_tag_colors())
        self.connect("destroy", lambda *_: unsubscribe())

    def _apply_tag_colors(self) -> None:
        for stream, tag in self._tags.items():
            tag.set_property("foreground-rgba", theme().color(STREAM_COLORS[stream]))

    def clear(self) -> None:
        self._buffer.set_text("")
        self._count = 0
        self._last_seq = None
        self._empty.set_visible(True)

    def set_lines(self, lines: Iterable[Mapping[str, Any]]) -> None:
        self.clear()
        self.append_lines(lines)

    def append_line(self, line: Mapping[str, Any] | str, stream: str = "stdout") -> None:
        self.append_lines([line if isinstance(line, Mapping) else {"text": line, "stream": stream}])

    def append_lines(self, lines: Iterable[Mapping[str, Any]]) -> None:
        added = 0
        for line in lines:
            seq = line.get("seq")
            if isinstance(seq, int):
                if self._last_seq is not None and seq <= self._last_seq:
                    continue
                self._last_seq = seq
            text = clean_log_text(str(line.get("text", "")))
            stream = line.get("stream", "stdout")
            prefix = "\n" if self._count else ""
            self._buffer.insert_with_tags(self._buffer.get_end_iter(), prefix + text, self._tags.get(stream, self._tags["stdout"]))
            self._count += 1
            added += 1
        if not added:
            return
        self._empty.set_visible(False)
        self._trim()

    def jump_to_end(self) -> None:
        self._following = True
        self._jump.set_visible(False)
        GLib.idle_add(self._scroll_to_end)

    def _trim(self) -> None:
        overflow = self._count - self._max_lines
        if overflow <= 0:
            return
        start = self._buffer.get_start_iter()
        _found, end = self._buffer.get_iter_at_line(overflow)
        self._buffer.delete(start, end)
        self._count -= overflow

    def _scroll_to_end(self) -> bool:
        adjustment = self._scroller.get_vadjustment()
        adjustment.set_value(adjustment.get_upper() - adjustment.get_page_size())
        return GLib.SOURCE_REMOVE

    def _on_scroll(self, adjustment: Gtk.Adjustment) -> None:
        distance = adjustment.get_upper() - adjustment.get_page_size() - adjustment.get_value()
        self._following = distance <= FOLLOW_THRESHOLD_PX
        self._jump.set_visible(not self._following and self._count > 0)

    def _on_content_changed(self, _adjustment: Gtk.Adjustment) -> None:
        if self._following:
            GLib.idle_add(self._scroll_to_end)
