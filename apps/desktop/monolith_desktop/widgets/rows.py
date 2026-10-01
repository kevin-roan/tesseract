from collections.abc import Callable

from gi.repository import Gtk

from ..theme.tone import TONE_COLORS, Tone
from .icon import IconBadge
from .surface import Pressable, Surface
from .text import Text


class KeyValueRow(Gtk.Box):
    def __init__(self, label: str, value: str, monospace: bool = False, tone: Tone | None = None) -> None:
        super().__init__(spacing=12, css_classes=["to-key-value"])
        self._label = Text(label, "bodySmall", "textSecondary")
        self._label.set_valign(Gtk.Align.START)
        self._value = Text(
            value,
            "code" if monospace else "bodySmall",
            TONE_COLORS[tone].foreground if tone else "text",
            wrap=True,
            lines=2,
            xalign=1.0,
            selectable=True,
        )
        self._value.set_hexpand(True)
        self._value.set_justify(Gtk.Justification.RIGHT)
        self.append(self._label)
        self.append(self._value)

    def set_value(self, value: str, tone: Tone | None = None) -> None:
        self._value.set_label(value)
        self._value.set_color(TONE_COLORS[tone].foreground if tone else "text")

    def set_label(self, label: str) -> None:
        self._label.set_label(label)


class KeyValueList(Gtk.Box):
    def __init__(self, rows: list[tuple[str, str]] | None = None, monospace: bool = False) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self._monospace = monospace
        self._rows: dict[str, KeyValueRow] = {}
        if rows:
            self.set_rows(rows)

    def set_rows(self, rows: list[tuple[str, str]]) -> None:
        keys = [label for label, _ in rows]
        for stale in [key for key in self._rows if key not in keys]:
            self.remove(self._rows.pop(stale))
        for label, value in rows:
            row = self._rows.get(label)
            if row is None:
                row = KeyValueRow(label, value, self._monospace)
                self._rows[label] = row
                self.append(row)
            else:
                row.set_value(value)


class ListCard(Gtk.Box):
    def __init__(
        self,
        icon: str,
        title: str,
        subtitle: str | None = None,
        value: str | None = None,
        value_label: str | None = None,
        on_activate: Callable[[], None] | None = None,
        trailing: Gtk.Widget | None = None,
    ) -> None:
        super().__init__(hexpand=True)
        self.surface = Surface(orientation=Gtk.Orientation.HORIZONTAL, spacing=12, compact=True)
        self.surface.add_css_class("to-list-card")
        self._badge = IconBadge(icon, large=True)
        self._badge.set_valign(Gtk.Align.CENTER)
        body = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, hexpand=True, valign=Gtk.Align.CENTER)
        self._title = Text(title, "bodyStrong")
        self._subtitle = Text(subtitle or "", "caption", "textTertiary")
        self._subtitle.set_visible(bool(subtitle))
        body.append(self._title)
        body.append(self._subtitle)
        self._trailing = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, valign=Gtk.Align.CENTER)
        self._value = Text(value or "", "h4", xalign=1.0)
        self._value_label = Text(value_label or "", "caption", "textTertiary", xalign=1.0)
        self._value.set_visible(bool(value))
        self._value_label.set_visible(bool(value and value_label))
        self._trailing.append(self._value)
        self._trailing.append(self._value_label)
        self._accessory = Gtk.Box(valign=Gtk.Align.CENTER)
        if trailing is not None:
            self._accessory.append(trailing)
        self.surface.append(self._badge)
        self.surface.append(body)
        self.surface.append(self._trailing)
        self.surface.append(self._accessory)
        if on_activate:
            button = Pressable(self.surface, on_activate, title)
            button.set_hexpand(True)
            self.append(button)
        else:
            self.append(self.surface)

    def update(
        self,
        title: str | None = None,
        subtitle: str | None = None,
        value: str | None = None,
        value_label: str | None = None,
        icon: str | None = None,
    ) -> None:
        if title is not None:
            self._title.set_label(title)
        self._subtitle.set_text_value(subtitle)
        self._value.set_text_value(value)
        self._value_label.set_text_value(value_label if value else None)
        if icon:
            self._badge.set_icon(icon)

    def set_trailing(self, widget: Gtk.Widget | None) -> None:
        while (child := self._accessory.get_first_child()) is not None:
            self._accessory.remove(child)
        if widget is not None:
            self._accessory.append(widget)
