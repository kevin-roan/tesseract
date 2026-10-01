from collections.abc import Callable
from typing import Literal

from gi.repository import Gtk

from .icon import Icon
from .text import Text

ButtonVariant = Literal["primary", "secondary", "flat", "destructive"]

_VARIANT_CLASSES: dict[str, tuple[str, ...]] = {
    "primary": ("to-primary",),
    "secondary": ("to-secondary",),
    "flat": ("flat",),
    "destructive": ("destructive-action", "to-secondary"),
}


class ActionButton(Gtk.Button):
    def __init__(
        self,
        label: str,
        on_activate: Callable[[], None] | None = None,
        variant: ButtonVariant = "primary",
        icon: str | None = None,
        tooltip: str | None = None,
    ) -> None:
        super().__init__(css_classes=list(_VARIANT_CLASSES[variant]), valign=Gtk.Align.CENTER)
        content = Gtk.Box(spacing=8, halign=Gtk.Align.CENTER)
        self._icon = Icon(icon or "add", "sm")
        self._icon.set_visible(icon is not None)
        self._label = Text(label, "label", lines=1)
        self._label.remove_css_class("to-fg-text")
        content.append(self._icon)
        content.append(self._label)
        self.set_child(content)
        if tooltip:
            self.set_tooltip_text(tooltip)
        if on_activate:
            self.connect("clicked", lambda *_: on_activate())

    def set_label_text(self, label: str) -> None:
        self._label.set_label(label)


class IconButton(Gtk.Button):
    def __init__(self, icon: str, label: str, on_activate: Callable[[], None] | None = None, flat: bool = True) -> None:
        super().__init__(child=Icon(icon, "sm"), tooltip_text=label, valign=Gtk.Align.CENTER)
        self.update_property([Gtk.AccessibleProperty.LABEL], [label])
        if flat:
            self.add_css_class("flat")
        if on_activate:
            self.connect("clicked", lambda *_: on_activate())


class Chip(Gtk.ToggleButton):
    def __init__(
        self,
        label: str,
        selected: bool = False,
        icon: str | None = None,
        on_toggled: Callable[[bool], None] | None = None,
    ) -> None:
        super().__init__(active=selected, css_classes=["to-chip"], valign=Gtk.Align.CENTER)
        content = Gtk.Box(spacing=4)
        if icon:
            content.append(Icon(icon, "sm"))
        text = Text(label, "label")
        text.remove_css_class("to-fg-text")
        content.append(text)
        self.set_child(content)
        if on_toggled:
            self.connect("toggled", lambda button: on_toggled(button.get_active()))


class ChipGroup(Gtk.FlowBox):
    def __init__(
        self,
        options: list[tuple[str, str]],
        selected: str | None = None,
        on_change: Callable[[str], None] | None = None,
    ) -> None:
        super().__init__(selection_mode=Gtk.SelectionMode.NONE, column_spacing=8, row_spacing=8, max_children_per_line=12)
        self._on_change = on_change
        self._chips: dict[str, Chip] = {}
        self._selected = selected
        self._syncing = False
        for option_id, label in options:
            chip = Chip(label, option_id == selected, on_toggled=lambda active, oid=option_id: self._toggled(oid, active))
            self._chips[option_id] = chip
            self.append(Gtk.FlowBoxChild(child=chip, focusable=False))

    @property
    def selected(self) -> str | None:
        return self._selected

    def select(self, option_id: str) -> None:
        self._syncing = True
        self._selected = option_id
        for oid, chip in self._chips.items():
            chip.set_active(oid == option_id)
        self._syncing = False

    def _toggled(self, option_id: str, active: bool) -> None:
        if self._syncing:
            return
        if not active and option_id == self._selected:
            self.select(option_id)
            return
        if active:
            self.select(option_id)
            if self._on_change:
                self._on_change(option_id)
