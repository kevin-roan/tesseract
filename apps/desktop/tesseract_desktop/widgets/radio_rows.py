from collections.abc import Callable, Sequence
from typing import Protocol

from gi.repository import Adw, Gtk


class RadioChoice(Protocol):
    id: str
    title: str
    subtitle: str
    available: bool


class RadioRows:
    """Keeps a single-choice list of Adw.ActionRows with radio prefixes in sync inside a group."""

    def __init__(self, container: Adw.PreferencesGroup, on_select: Callable[[str], None]) -> None:
        self._container = container
        self._on_select = on_select
        self._rows: dict[str, tuple[Adw.ActionRow, Gtk.CheckButton]] = {}
        self._syncing = False

    def set_choices(self, choices: Sequence[RadioChoice], selected: str | None, busy: bool = False) -> None:
        self._syncing = True
        if [choice.id for choice in choices] != list(self._rows):
            self._rebuild([choice.id for choice in choices])
        for choice in choices:
            row, check = self._rows[choice.id]
            row.set_title(choice.title)
            row.set_subtitle(choice.subtitle)
            row.set_sensitive(choice.available and not busy)
            check.set_active(choice.id == selected)
        self._syncing = False

    def _rebuild(self, ids: list[str]) -> None:
        for row, _check in self._rows.values():
            self._container.remove(row)
        self._rows.clear()
        group: Gtk.CheckButton | None = None
        for choice_id in ids:
            check = Gtk.CheckButton(valign=Gtk.Align.CENTER, group=group)
            check.connect("toggled", self._toggled, choice_id)
            group = group or check
            row = Adw.ActionRow(use_markup=False, activatable_widget=check)
            row.add_prefix(check)
            self._container.add(row)
            self._rows[choice_id] = (row, check)

    def _toggled(self, check: Gtk.CheckButton, choice_id: str) -> None:
        if not self._syncing and check.get_active():
            self._on_select(choice_id)

    def __len__(self) -> int:
        return len(self._rows)
