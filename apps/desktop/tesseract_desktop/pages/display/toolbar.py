from collections.abc import Callable, Iterable

from gi.repository import Adw, Gio, Gtk

from ...theme.icons import resolve_icon
from ...theme.tone import Tone
from ...widgets import Icon, StatusBadge, Text

SCALE_FIT = "fit"
SCALE_ACTUAL = "actual"


def _flat(button: Gtk.Widget, tooltip: str) -> Gtk.Widget:
    button.add_css_class("flat")
    button.set_tooltip_text(tooltip)
    button.set_valign(Gtk.Align.CENTER)
    button.update_property([Gtk.AccessibleProperty.LABEL], [tooltip])
    return button


def action_button(action: str, icon: str, tooltip: str) -> Gtk.Button:
    return _flat(Gtk.Button(child=Icon(icon, "sm"), action_name=action), tooltip)


def action_toggle(action: str, icon: str, tooltip: str) -> Gtk.ToggleButton:
    return _flat(Gtk.ToggleButton(child=Icon(icon, "sm"), action_name=action), tooltip)


def menu_button(icon: str, tooltip: str, menu: Gio.MenuModel) -> Gtk.MenuButton:
    return _flat(Gtk.MenuButton(icon_name=resolve_icon(icon), menu_model=menu), tooltip)


def target_menu(action: str, items: Iterable[tuple[str, str]]) -> Gio.Menu:
    menu = Gio.Menu()
    for target, label in items:
        menu.append(label, f"{action}::{target}")
    return menu


class ScaleToggle(Gtk.Box):
    def __init__(self, labels: dict[str, tuple[str, str]], on_change: Callable[[bool], None]) -> None:
        super().__init__(valign=Gtk.Align.CENTER)
        self._group = Adw.ToggleGroup(css_classes=["to-display-scale"])
        for name, (label, tooltip) in labels.items():
            self._group.add(Adw.Toggle(name=name, label=label, tooltip=tooltip))
        self._group.set_active_name(SCALE_FIT)
        self._group.connect("notify::active-name", lambda group, _p: on_change(group.get_active_name() == SCALE_FIT))
        self.append(self._group)

    def set_fit(self, fit: bool) -> None:
        name = SCALE_FIT if fit else SCALE_ACTUAL
        if self._group.get_active_name() != name:
            self._group.set_active_name(name)


class DisplayToolbar(Gtk.Box):
    def __init__(self) -> None:
        super().__init__(spacing=12, css_classes=["to-display-toolbar"])
        info = Gtk.Box(spacing=10, hexpand=True, valign=Gtk.Align.CENTER)
        self._badge = StatusBadge("")
        self._meta = Text("", "caption", "textSecondary")
        self._meta.set_hexpand(True)
        info.append(self._badge)
        info.append(self._meta)
        self.append(info)
        self._actions = Gtk.Box(spacing=4, valign=Gtk.Align.CENTER)
        self.append(self._actions)
        self.secondary: list[Gtk.Widget] = []
        self.overflow: list[Gtk.Widget] = []

    def add(self, widget: Gtk.Widget, secondary: bool = False, overflow: bool = False) -> Gtk.Widget:
        self._actions.append(widget)
        if secondary:
            self.secondary.append(widget)
        if overflow:
            self.overflow.append(widget)
            widget.set_visible(False)
        return widget

    def add_separator(self) -> None:
        self.add(Gtk.Separator(orientation=Gtk.Orientation.VERTICAL, css_classes=["to-display-separator"]), secondary=True)

    def set_status(self, label: str, tone: Tone) -> None:
        self._badge.update(label, tone)

    def set_meta(self, text: str | None) -> None:
        self._meta.set_text_value(text)

    def compact_setters(self, breakpoint: Adw.Breakpoint) -> None:
        for widget in self.secondary:
            breakpoint.add_setter(widget, "visible", False)
        for widget in self.overflow:
            breakpoint.add_setter(widget, "visible", True)
