from collections.abc import Callable

from gi.repository import Gtk

from ...theme.tokens import SPACING
from ...theme.tone import Tone
from ...viewmodels import StatItem
from ...widgets import Icon, IconButton, KeyValueList, StatusBadge, Text


class OverviewHeader(Gtk.Box):
    def __init__(self, title: str, refresh_label: str, on_refresh: Callable[[], None]) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=SPACING["xs"], css_classes=["to-overview-header"])
        top = Gtk.Box(spacing=SPACING["md"])
        self._title = Text(title, "h1")
        self._badge = StatusBadge("")
        top.append(self._title)
        top.append(self._badge)
        top.append(Gtk.Box(hexpand=True))
        top.append(IconButton("refresh", refresh_label, on_refresh))
        self._meta = Text("", "bodySmall", "textSecondary")
        self.append(top)
        self.append(self._meta)

    def set_title(self, title: str) -> None:
        self._title.set_label(title)

    def set_meta(self, meta: str | None) -> None:
        self._meta.set_text_value(meta)

    def set_status(self, label: str, tone: Tone) -> None:
        self._badge.update(label, tone)


class FlatList(KeyValueList):
    def __init__(self, monospace: bool = False) -> None:
        super().__init__(monospace=monospace)
        self.add_css_class("to-flat-list")


class ActivityRow(Gtk.ListBoxRow):
    def __init__(self, item: StatItem) -> None:
        super().__init__(css_classes=["to-flat-row"])
        content = Gtk.Box(spacing=SPACING["sm"])
        self._icon = Icon(item.icon, "sm", "textSecondary")
        self._label = Text(item.label, "body")
        self._label.set_hexpand(True)
        self._value = Text(item.value, "body", "textSecondary", xalign=1.0)
        self._value.add_css_class("to-tabular")
        content.append(self._icon)
        content.append(self._label)
        content.append(self._value)
        self.set_child(content)
        self.update(item)

    def update(self, item: StatItem) -> None:
        self.item = item
        self._icon.set_icon(item.icon)
        self._label.set_label(item.label)
        self._value.set_label(item.value)
        self.set_activatable(item.on_activate is not None)


class ActivityList(Gtk.ListBox):
    def __init__(self) -> None:
        super().__init__(selection_mode=Gtk.SelectionMode.NONE, css_classes=["to-flat-rows"])
        self._rows: dict[str, ActivityRow] = {}
        self.connect("row-activated", lambda _list, row: row.item.on_activate and row.item.on_activate())

    def set_items(self, items: list[StatItem]) -> None:
        wanted = {item.id for item in items}
        for stale in [key for key in self._rows if key not in wanted]:
            self.remove(self._rows.pop(stale))
        for index, item in enumerate(items):
            row = self._rows.get(item.id)
            if row is None:
                row = ActivityRow(item)
                self._rows[item.id] = row
                self.insert(row, index)
            else:
                row.update(item)
