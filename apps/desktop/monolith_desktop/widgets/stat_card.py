from collections.abc import Callable

from gi.repository import Gtk

from ..theme.surfaces import SurfaceTone
from ..viewmodels import StatItem
from .icon import IconBadge
from .progress import ProgressRing
from .surface import Pressable, Surface
from .text import Text

MIN_HEIGHT = 148
RING_COLOR = "highlight"
RING_TRACK_LABEL = "textSecondary"


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
        self.surface = Surface(tone, spacing=20)
        self.surface.set_size_request(-1, MIN_HEIGHT)
        self.surface.set_hexpand(True)
        self.surface.add_css_class("to-stat-card")

        top = Gtk.Box(hexpand=True)
        self._badge = IconBadge(icon)
        top.append(self._badge)
        spacer = Gtk.Box(hexpand=True)
        top.append(spacer)
        self._ring = ProgressRing(progress or 0.0, color=RING_COLOR, label_color=RING_TRACK_LABEL)
        self._ring.set_visible(progress is not None)
        top.append(self._ring)

        bottom = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, vexpand=True, valign=Gtk.Align.END)
        self._label = Text(label, "bodySmall", "textSecondary")
        value_row = Gtk.Box(spacing=4, valign=Gtk.Align.BASELINE_FILL)
        self._value = Text(value, "h2")
        self._value.set_valign(Gtk.Align.BASELINE_FILL)
        self._unit = Text(unit or "", "caption", "textTertiary")
        self._unit.set_valign(Gtk.Align.BASELINE_FILL)
        self._unit.set_visible(bool(unit))
        value_row.append(self._value)
        value_row.append(self._unit)
        self._caption = Text(caption or "", "caption", "textTertiary")
        self._caption.set_visible(bool(caption))
        bottom.append(self._label)
        bottom.append(value_row)
        bottom.append(self._caption)

        self.surface.append(top)
        self.surface.append(bottom)
        if on_activate:
            button = Pressable(self.surface, on_activate, label)
            button.set_hexpand(True)
            self.append(button)
        else:
            self.append(self.surface)

    def set_value(self, value: str, unit: str | None = None) -> None:
        self._value.set_label(value)
        self._unit.set_text_value(unit)

    def set_label(self, label: str) -> None:
        self._label.set_label(label)

    def set_caption(self, caption: str | None) -> None:
        self._caption.set_text_value(caption)

    def set_progress(self, progress: float | None) -> None:
        self._ring.set_visible(progress is not None)
        if progress is not None:
            self._ring.set_progress(progress)

    def set_icon(self, icon: str) -> None:
        self._badge.set_icon(icon)

    def set_tone(self, tone: SurfaceTone) -> None:
        self.surface.set_tone(tone)

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
            column_spacing=12,
            row_spacing=12,
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
