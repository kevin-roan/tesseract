from collections.abc import Callable

from gi.repository import Gtk

from ..theme.surfaces import SurfaceTone
from ..theme.tokens import SPACING
from ..util.format import clamp_fraction
from ..viewmodels import StatItem
from .icon import Icon
from .progress import ProgressBar
from .surface import Pressable
from .text import Text

CAPTION_CHARS = 10


class StatCard(Gtk.Box):
    def __init__(
        self,
        icon: str,
        label: str,
        value: str,
        unit: str | None = None,
        progress: float | None = None,
        tone: SurfaceTone = "neutral",
        caption: str | None = None,
        on_activate: Callable[[], None] | None = None,
    ) -> None:
        super().__init__(hexpand=True)
        self._tone = tone
        self.tile = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=SPACING["sm"], hexpand=True)
        self.tile.add_css_class("to-metric-tile")
        self.tile.add_css_class(f"metric-{tone}")

        top = Gtk.Box(spacing=SPACING["sm"] - 2)
        self._icon = Icon(icon, "xs", "textTertiary")
        self._label = Text(label, "bodySmall", "textSecondary")
        self._label.set_hexpand(True)
        self._percent = Text("", "caption", "textTertiary", xalign=1.0)
        self._percent.add_css_class("to-tabular")
        top.append(self._icon)
        top.append(self._label)
        top.append(self._percent)

        values = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=SPACING["xxs"], vexpand=True)
        value_row = Gtk.Box(spacing=SPACING["xs"], valign=Gtk.Align.BASELINE_FILL)
        self._value = Text(value, "metricSmall")
        self._value.set_valign(Gtk.Align.BASELINE_FILL)
        self._unit = Text(unit or "", "bodySmall", "textSecondary")
        self._unit.set_valign(Gtk.Align.BASELINE_FILL)
        value_row.append(self._value)
        value_row.append(self._unit)
        self._caption = Text(caption or "", "caption", "textTertiary")
        self._caption.set_max_width_chars(CAPTION_CHARS)
        values.append(value_row)
        values.append(self._caption)

        self._bar = ProgressBar(0.0, "neutral", label)
        self._bar.set_valign(Gtk.Align.END)
        self._bar.add_css_class("to-metric-bar")

        self.tile.append(top)
        self.tile.append(values)
        self.tile.append(self._bar)
        if on_activate:
            button = Pressable(self.tile, on_activate, label)
            button.set_hexpand(True)
            self.append(button)
        else:
            self.append(self.tile)
        self.set_value(value, unit)
        self.set_caption(caption)
        self.set_progress(progress)

    def set_value(self, value: str, unit: str | None = None) -> None:
        self._value.set_label(value)
        self._unit.set_text_value(unit)

    def set_label(self, label: str) -> None:
        self._label.set_label(label)

    def set_caption(self, caption: str | None) -> None:
        self._caption.set_text_value(caption)

    def set_progress(self, progress: float | None) -> None:
        self._bar.set_visible(progress is not None)
        self._percent.set_visible(progress is not None)
        if progress is not None:
            self._bar.set_progress(progress)
            self._percent.set_label(f"{round(clamp_fraction(progress) * 100)}%")

    def set_icon(self, icon: str) -> None:
        self._icon.set_icon(icon)

    def set_tone(self, tone: SurfaceTone) -> None:
        self.tile.remove_css_class(f"metric-{self._tone}")
        self._tone = tone
        self.tile.add_css_class(f"metric-{tone}")

    def update(self, item: StatItem) -> None:
        self.set_label(item.label)
        self.set_value(item.value, item.unit)
        self.set_progress(item.progress)
        self.set_caption(item.caption)
        self.set_icon(item.icon)
        self.set_tone(item.tone)


class StatGrid(Gtk.FlowBox):
    def __init__(self, items: list[StatItem] | None = None, min_columns: int = 2, max_columns: int = 4) -> None:
        super().__init__(
            selection_mode=Gtk.SelectionMode.NONE,
            homogeneous=True,
            column_spacing=SPACING["sm"],
            row_spacing=SPACING["sm"],
            min_children_per_line=min_columns,
            max_children_per_line=max_columns,
        )
        self.add_css_class("to-stat-grid")
        self._cards: dict[str, StatCard] = {}
        self._children: dict[str, Gtk.FlowBoxChild] = {}
        if items:
            self.set_items(items)

    def card(self, item_id: str) -> StatCard | None:
        return self._cards.get(item_id)

    def set_items(self, items: list[StatItem]) -> None:
        wanted = [item.id for item in items]
        for stale in [key for key in self._cards if key not in wanted]:
            self.remove(self._children.pop(stale))
            del self._cards[stale]
        for index, item in enumerate(items):
            card = self._cards.get(item.id)
            if card is None:
                card = StatCard(
                    item.icon, item.label, item.value, item.unit, item.progress, item.tone, item.caption, item.on_activate
                )
                child = Gtk.FlowBoxChild(child=card, focusable=False)
                self._cards[item.id] = card
                self._children[item.id] = child
                self.insert(child, index)
            else:
                card.update(item)
