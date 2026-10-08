from collections.abc import Callable, Iterable
from typing import Any, TypeVar

from gi.repository import Gtk

W = TypeVar("W", bound=Gtk.Widget)


class KeyedList(Gtk.ListBox):
    def __init__(
        self,
        create: Callable[[], W],
        update: Callable[[W, Any], None],
    ) -> None:
        super().__init__(selection_mode=Gtk.SelectionMode.NONE, css_classes=["to-record-list"])
        self._create = create
        self._update = update
        self._rows: dict[str, Gtk.ListBoxRow] = {}
        self._order: list[str] = []
        self.connect("row-activated", lambda _list, row: self._activated(row.get_child()))

    def _activated(self, child: Gtk.Widget) -> None:
        activate = getattr(child, "activate_row", None)
        if callable(activate):
            activate()

    @property
    def keys(self) -> list[str]:
        return list(self._order)

    def widget(self, key: str) -> W | None:
        row = self._rows.get(key)
        return row.get_child() if row else None

    def sync(self, items: Iterable[tuple[str, Any]]) -> None:
        pairs = list(items)
        keys = [key for key, _ in pairs]
        for stale in [key for key in self._rows if key not in keys]:
            self.remove(self._rows.pop(stale))
        for key, data in pairs:
            row = self._rows.get(key)
            if row is None:
                row = Gtk.ListBoxRow(child=self._create())
                self._rows[key] = row
            self._update(row.get_child(), data)
            row.set_activatable(bool(getattr(row.get_child(), "activatable", False)))
        if keys != self._order:
            for row in self._rows.values():
                if row.get_parent() is self:
                    self.remove(row)
            for key in keys:
                self.append(self._rows[key])
        self._order = keys
        self.set_visible(bool(keys))

