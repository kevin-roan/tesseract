from collections.abc import Callable

from gi.repository import Adw, Gtk

from .buttons import ActionButton, ButtonVariant
from .choice_dropdown import ChoiceDropdown, Option


class PreferenceRows:
    """Keeps a list of read-only (title, subtitle) Adw.ActionRows in sync inside a group or expander row."""

    def __init__(self, container: Adw.PreferencesGroup | Adw.ExpanderRow, selectable: bool = False) -> None:
        self._container = container
        self._selectable = selectable
        self._rows: list[Adw.ActionRow] = []

    def set_rows(self, rows: list[tuple[str, str]]) -> None:
        while len(self._rows) > len(rows):
            self._container.remove(self._rows.pop())
        for index, (title, subtitle) in enumerate(rows):
            if index == len(self._rows):
                row = Adw.ActionRow(css_classes=["property"], use_markup=False)
                row.set_subtitle_selectable(self._selectable)
                if isinstance(self._container, Adw.ExpanderRow):
                    self._container.add_row(row)
                else:
                    self._container.add(row)
                self._rows.append(row)
            self._rows[index].set_title(title)
            self._rows[index].set_subtitle(subtitle)

    def __len__(self) -> int:
        return len(self._rows)


def entry_row(
    title: str, subtitle: str | None = None, password: bool = False, on_activate: Callable[[], None] | None = None
) -> tuple[Adw.ActionRow, Gtk.Editable]:
    """A settings row with the label on the left and a compact 32px input on the right."""
    row = Adw.ActionRow(title=title, subtitle=subtitle or "", use_markup=False)
    entry = Gtk.PasswordEntry(show_peek_icon=True) if password else Gtk.Entry()
    entry.set_valign(Gtk.Align.CENTER)
    entry.add_css_class("to-row-entry")
    if on_activate:
        entry.connect("activate", lambda *_: on_activate())
    row.add_suffix(entry)
    return row, entry


def choice_row(
    title: str, subtitle: str | None, options: list[Option], on_change: Callable[[str], None]
) -> tuple[Adw.ActionRow, ChoiceDropdown]:
    """A settings row with a dropdown on the right."""
    row = Adw.ActionRow(title=title, subtitle=subtitle or "", use_markup=False)
    dropdown = ChoiceDropdown(options, on_change=on_change)
    row.add_suffix(dropdown)
    return row, dropdown


class SpinRow(Adw.ActionRow):
    """A settings row with a number input on the right; `on_change` only fires for user edits."""

    def __init__(
        self,
        title: str,
        subtitle: str | None,
        bounds: tuple[float, float],
        step: float,
        on_change: Callable[[float], None],
        digits: int = 0,
    ) -> None:
        super().__init__(title=title, subtitle=subtitle or "", use_markup=False)
        self._syncing = False
        self._spin = Gtk.SpinButton.new_with_range(bounds[0], bounds[1], step)
        self._spin.set_digits(digits)
        self._spin.set_numeric(True)
        self._spin.set_valign(Gtk.Align.CENTER)
        self._spin.connect("value-changed", lambda spin: None if self._syncing else on_change(spin.get_value()))
        self.add_suffix(self._spin)

    @property
    def value(self) -> float:
        return self._spin.get_value()

    def set_value(self, value: float) -> None:
        self._syncing = True
        self._spin.set_value(value)
        self._syncing = False


def button_row(
    title: str,
    subtitle: str | None,
    label: str,
    on_activate: Callable[[], None],
    variant: ButtonVariant = "secondary",
) -> tuple[Adw.ActionRow, ActionButton]:
    row = Adw.ActionRow(title=title, subtitle=subtitle or "", use_markup=False)
    button = ActionButton(label, on_activate, variant)
    row.add_suffix(button)
    return row, button


class SettingsActions(Gtk.Box):
    """Right-aligned buttons under a settings group (Save, Rediscover …)."""

    def __init__(self) -> None:
        super().__init__(spacing=8, halign=Gtk.Align.END, margin_top=12, css_classes=["to-settings-actions"])

    def add(self, label: str, on_activate: Callable[[], None], variant: ButtonVariant = "secondary", icon: str | None = None) -> ActionButton:
        button = ActionButton(label, on_activate, variant, icon)
        self.append(button)
        return button
