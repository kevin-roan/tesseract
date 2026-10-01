from collections.abc import Callable

from gi.repository import GLib, Gtk

from .icon import Icon
from .text import Text

COPIED_RESET_MS = 1500


def copy_to_clipboard(widget: Gtk.Widget, text: str) -> None:
    widget.get_clipboard().set(text)


class CopyButton(Gtk.Button):
    def __init__(self, get_text: Callable[[], str], label: str, copied_label: str) -> None:
        super().__init__(css_classes=["flat", "to-copy-button"], valign=Gtk.Align.CENTER, tooltip_text=label)
        self._get_text = get_text
        self._icon = Icon("copy", "xs")
        self.set_child(self._icon)
        self._label = label
        self._copied_label = copied_label
        self._reset_source: int | None = None
        self.update_property([Gtk.AccessibleProperty.LABEL], [label])
        self.connect("clicked", self._copy)
        self.connect("unrealize", lambda *_: self._clear())

    def _copy(self, *_args) -> None:
        copy_to_clipboard(self, self._get_text())
        self._icon.set_icon("success")
        self.set_tooltip_text(self._copied_label)
        self._clear()
        self._reset_source = GLib.timeout_add(COPIED_RESET_MS, self._reset)

    def _reset(self) -> bool:
        self._reset_source = None
        self._icon.set_icon("copy")
        self.set_tooltip_text(self._label)
        return GLib.SOURCE_REMOVE

    def _clear(self) -> None:
        if self._reset_source is not None:
            GLib.source_remove(self._reset_source)
            self._reset_source = None


class CodeBlock(Gtk.Box):
    def __init__(self, code: str, language: str = "", copy_label: str = "Copy", copied_label: str = "Copied") -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, css_classes=["to-code-block"])
        self.set_overflow(Gtk.Overflow.HIDDEN)
        self._code = code
        header = Gtk.Box(spacing=8, css_classes=["to-code-block-header"])
        self._language = Text(language, "caption", "textTertiary")
        self._language.set_hexpand(True)
        header.append(self._language)
        header.append(CopyButton(lambda: self._code, copy_label, copied_label))
        self.append(header)
        self._label = Gtk.Label(
            label=code, xalign=0.0, yalign=0.0, selectable=True, css_classes=["to-text-code", "to-code-block-body"]
        )
        self._label.set_focusable(False)
        scroller = Gtk.ScrolledWindow(
            child=self._label,
            hscrollbar_policy=Gtk.PolicyType.AUTOMATIC,
            vscrollbar_policy=Gtk.PolicyType.NEVER,
            propagate_natural_height=True,
        )
        self.append(scroller)

    def set_code(self, code: str, language: str | None = None) -> None:
        self._code = code
        self._label.set_label(code)
        if language is not None:
            self._language.set_label(language)

