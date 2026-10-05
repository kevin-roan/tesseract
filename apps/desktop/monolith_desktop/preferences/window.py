from gi.repository import Adw, Gtk

from ..strings import PREFERENCES as S
from ..widgets.dialog import DialogHeader
from ..widgets.icon import Icon
from ..widgets.text import Text
from .base import PreferencesPage

SETTINGS_SIZE = (880, 620)


class SettingsNavRow(Gtk.ListBoxRow):
    def __init__(self, page: PreferencesPage) -> None:
        super().__init__(css_classes=["to-settings-nav-row"])
        self.page_id = page.id
        content = Gtk.Box(spacing=10)
        content.append(Icon(page.icon_key, "sm", "textSecondary"))
        content.append(Text(page.get_title(), "label"))
        self.set_child(content)


class SettingsDialog(Adw.Dialog):
    """Linear-style settings: a sidebar of pages on the left, the selected page on the right under a
    `Settings › Page` breadcrumb. Pages call `add_toast` on it like on an Adw.PreferencesDialog."""

    def __init__(self) -> None:
        width, height = SETTINGS_SIZE
        super().__init__(title=S["dialog_title"], content_width=width, content_height=height)
        self.add_css_class("to-settings")
        self._pages: dict[str, PreferencesPage] = {}

        nav = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4, css_classes=["to-settings-nav"])
        nav.append(Text(S["dialog_title"], "overline", "textSecondary"))
        self._list = Gtk.ListBox(selection_mode=Gtk.SelectionMode.SINGLE, css_classes=["to-settings-nav-list"])
        self._list.connect("row-selected", self._row_selected)
        nav.append(self._list)

        self._header = DialogHeader("", S["dialog_title"], "settings", self.close)
        self._stack = Gtk.Stack(transition_type=Gtk.StackTransitionType.CROSSFADE, vexpand=True, hexpand=True)
        content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, hexpand=True, css_classes=["to-settings-content"])
        content.append(self._header)
        content.append(self._stack)

        split = Gtk.Box(css_classes=["to-settings-root"])
        split.append(nav)
        split.append(content)
        self._toasts = Adw.ToastOverlay(child=split)
        self.set_child(self._toasts)

    def add(self, page: PreferencesPage) -> None:
        self._pages[page.id] = page
        self._stack.add_named(page, page.id)
        row = SettingsNavRow(page)
        self._list.append(row)
        if len(self._pages) == 1:
            self._list.select_row(row)

    def set_visible_page_name(self, page_id: str) -> None:
        row = self._list.get_first_child()
        while row is not None:
            if isinstance(row, SettingsNavRow) and row.page_id == page_id:
                self._list.select_row(row)
                return
            row = row.get_next_sibling()

    def add_toast(self, toast: Adw.Toast) -> None:
        self._toasts.add_toast(toast)

    def _row_selected(self, _list: Gtk.ListBox, row: Gtk.ListBoxRow | None) -> None:
        if isinstance(row, SettingsNavRow):
            self._stack.set_visible_child_name(row.page_id)
            self._header.breadcrumb.set_title(self._pages[row.page_id].get_title())
