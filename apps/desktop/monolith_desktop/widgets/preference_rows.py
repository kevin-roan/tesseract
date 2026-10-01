from gi.repository import Adw


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
