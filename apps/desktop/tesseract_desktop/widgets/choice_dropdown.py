from collections.abc import Callable

from gi.repository import Gtk

Option = tuple[str, str]


class ChoiceDropdown(Gtk.DropDown):
    def __init__(
        self,
        options: list[Option] | None = None,
        selected: str | None = None,
        on_change: Callable[[str], None] | None = None,
        tooltip: str | None = None,
    ) -> None:
        self._model = Gtk.StringList()
        super().__init__(model=self._model, valign=Gtk.Align.CENTER, css_classes=["to-choice-dropdown", "flat"])
        self._ids: list[str] = []
        self._on_change = on_change
        self._syncing = False
        if tooltip:
            self.set_tooltip_text(tooltip)
        self.connect("notify::selected", self._selected_changed)
        self.set_options(options or [], selected)

    @property
    def selected_id(self) -> str | None:
        index = self.get_selected()
        return self._ids[index] if 0 <= index < len(self._ids) else None

    def set_options(self, options: list[Option], selected: str | None = None) -> None:
        keep = selected if selected is not None else self.selected_id
        if [oid for oid, _ in options] == self._ids and all(
            self._model.get_string(i) == label for i, (_oid, label) in enumerate(options)
        ):
            if keep is not None:
                self.select(keep)
            return
        self._syncing = True
        self._ids = [oid for oid, _ in options]
        self._model.splice(0, self._model.get_n_items(), [label for _, label in options])
        self._syncing = False
        self.select(keep if keep in self._ids else (self._ids[0] if self._ids else None))

    def select(self, option_id: str | None) -> None:
        if option_id not in self._ids:
            return
        self._syncing = True
        self.set_selected(self._ids.index(option_id))
        self._syncing = False

    def _selected_changed(self, *_args) -> None:
        if self._syncing or self._on_change is None:
            return
        selected = self.selected_id
        if selected is not None:
            self._on_change(selected)
