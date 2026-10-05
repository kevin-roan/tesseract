from collections.abc import Callable

from gi.repository import Gtk


class SegmentedControl(Gtk.Box):
    """A pill strip of mutually exclusive segments; `on_change` fires with the chosen id."""

    def __init__(self, options: list[tuple[str, str]], selected: str, on_change: Callable[[str], None], label: str) -> None:
        super().__init__(css_classes=["to-segmented"], halign=Gtk.Align.START, spacing=2)
        self.update_property([Gtk.AccessibleProperty.LABEL], [label])
        self._on_change = on_change
        self._selected = selected
        self._buttons: dict[str, Gtk.ToggleButton] = {}
        group: Gtk.ToggleButton | None = None
        for option_id, text in options:
            button = Gtk.ToggleButton(label=text, active=option_id == selected, css_classes=["to-segment"], group=group)
            button.connect("toggled", lambda b, oid=option_id: self._toggled(oid, b.get_active()))
            group = group or button
            self._buttons[option_id] = button
            self.append(button)

    @property
    def selected(self) -> str:
        return self._selected

    def select(self, option_id: str) -> None:
        if option_id in self._buttons:
            self._selected = option_id
            self._buttons[option_id].set_active(True)

    def _toggled(self, option_id: str, active: bool) -> None:
        if active and option_id != self._selected:
            self._selected = option_id
            self._on_change(option_id)
