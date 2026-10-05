from collections.abc import Callable

from gi.repository import Adw, Gtk

from .motion import crossfade_stack
from .text import Text


class SectionHeader(Gtk.Box):
    def __init__(
        self,
        title: str,
        action_label: str | None = None,
        on_action: Callable[[], None] | None = None,
        subtitle: str | None = None,
    ) -> None:
        super().__init__(spacing=8, css_classes=["to-section-header"])
        titles = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, hexpand=True)
        self._title = Text(title, "label")
        self._title.add_css_class("to-section-title")
        self._subtitle = Text(subtitle or "", "caption", "textSecondary")
        self._subtitle.set_visible(bool(subtitle))
        titles.append(self._title)
        titles.append(self._subtitle)
        self.append(titles)
        self._trailing = Gtk.Box(spacing=8, valign=Gtk.Align.CENTER)
        self.append(self._trailing)
        if action_label and on_action:
            button = Gtk.Button(label=action_label, css_classes=["flat", "to-link-button"], valign=Gtk.Align.CENTER)
            button.connect("clicked", lambda *_: on_action())
            self._trailing.append(button)

    def set_title(self, title: str) -> None:
        self._title.set_label(title)

    def set_subtitle(self, subtitle: str | None) -> None:
        self._subtitle.set_text_value(subtitle)

    def add_trailing(self, widget: Gtk.Widget) -> None:
        self._trailing.append(widget)


class Section(Gtk.Box):
    def __init__(
        self,
        title: str,
        child: Gtk.Widget | None = None,
        action_label: str | None = None,
        on_action: Callable[[], None] | None = None,
        empty_label: str | None = None,
        subtitle: str | None = None,
    ) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        self.header = SectionHeader(title, action_label, on_action, subtitle)
        self.append(self.header)
        self._stack = crossfade_stack(vhomogeneous=False, hhomogeneous=False)
        self._stack.add_named(Adw.Spinner(halign=Gtk.Align.START, width_request=16, height_request=16), "loading")
        self._empty = Text(empty_label or "", "bodySmall", "textSecondary", wrap=True, lines=None)
        self._stack.add_named(self._empty, "empty")
        self._content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self._stack.add_named(self._content, "content")
        self._stack.set_visible_child_name("content")
        self.append(self._stack)
        if child is not None:
            self.set_child(child)

    def set_child(self, child: Gtk.Widget) -> None:
        while (existing := self._content.get_first_child()) is not None:
            self._content.remove(existing)
        self._content.append(child)

    def set_loading(self, loading: bool) -> None:
        if loading:
            self._stack.set_visible_child_name("loading")
        elif self._stack.get_visible_child_name() == "loading":
            self._stack.set_visible_child_name("content")

    def set_empty(self, empty: bool, label: str | None = None) -> None:
        if label is not None:
            self._empty.set_label(label)
        self._stack.set_visible_child_name("empty" if empty else "content")
