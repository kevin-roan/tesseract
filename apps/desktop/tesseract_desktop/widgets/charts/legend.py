from collections.abc import Callable, Sequence
from dataclasses import dataclass

import cairo
from gi.repository import Gtk

from ..drawing import ThemedDrawing, set_source
from ..text import Text

KEY_WIDTH = 12
KEY_HEIGHT = 8
KEY_LINE_WIDTH = 2.0


@dataclass(frozen=True)
class LegendItem:
    key: str
    label: str
    color: int
    dash: tuple[float, ...] = ()
    active: bool = True
    compact: bool = False


class LineKey(ThemedDrawing):
    def __init__(self, color: int, dash: tuple[float, ...] = ()) -> None:
        super().__init__(self._paint)
        self._dash = dash
        self.add_css_class(f"to-chart-{color}")
        self.set_content_width(KEY_WIDTH)
        self.set_content_height(KEY_HEIGHT)
        self.set_valign(Gtk.Align.CENTER)

    def _paint(self, cr, width: int, height: int) -> None:
        cr.set_line_width(KEY_LINE_WIDTH)
        cr.set_line_cap(cairo.LINE_CAP_ROUND)
        cr.set_dash(self._dash)
        set_source(cr, self.get_color())
        cr.move_to(KEY_LINE_WIDTH, height / 2)
        cr.line_to(width - KEY_LINE_WIDTH, height / 2)
        cr.stroke()


class SeriesToggle(Gtk.ToggleButton):
    def __init__(self, item: LegendItem, on_toggled: Callable[[str, bool], None]) -> None:
        super().__init__(active=item.active, css_classes=["to-series-toggle"], valign=Gtk.Align.CENTER)
        self.key = item.key
        self._label = item.label
        content = Gtk.Box(spacing=6)
        content.append(LineKey(item.color, item.dash))
        content.append(Text(item.label, "caption", "textSecondary"))
        self._value = Text("", "caption")
        self._value.add_css_class("to-series-value")
        content.append(self._value)
        if item.compact:
            self.add_css_class("compact")
        self.set_child(content)
        self.set_tooltip_text(item.label)
        self.update_property([Gtk.AccessibleProperty.LABEL], [item.label])
        self.connect("toggled", lambda button: on_toggled(self.key, button.get_active()))

    def update(self, value: str, caption: str) -> None:
        self._value.set_label(value)
        self.set_tooltip_text(f"{self._label} · {caption}" if caption else self._label)


class SeriesLegend(Gtk.FlowBox):
    def __init__(self, items: Sequence[LegendItem], on_change: Callable[[set[str]], None] | None = None) -> None:
        super().__init__(
            selection_mode=Gtk.SelectionMode.NONE,
            column_spacing=6,
            row_spacing=6,
            max_children_per_line=len(items) or 1,
            halign=Gtk.Align.START,
            css_classes=["to-series-legend"],
        )
        self._on_change = on_change
        self._toggles: dict[str, SeriesToggle] = {}
        self._syncing = False
        for item in items:
            toggle = SeriesToggle(item, self._toggled)
            self._toggles[item.key] = toggle
            self.append(Gtk.FlowBoxChild(child=toggle, focusable=False, halign=Gtk.Align.START))

    @property
    def hidden(self) -> set[str]:
        return {key for key, toggle in self._toggles.items() if not toggle.get_active()}

    def update(self, key: str, value: str, caption: str) -> None:
        toggle = self._toggles.get(key)
        if toggle is not None:
            toggle.update(value, caption)

    def _toggled(self, key: str, active: bool) -> None:
        if self._syncing:
            return
        if not active and len(self.hidden) == len(self._toggles):
            self._syncing = True
            self._toggles[key].set_active(True)
            self._syncing = False
            return
        if self._on_change:
            self._on_change(self.hidden)
