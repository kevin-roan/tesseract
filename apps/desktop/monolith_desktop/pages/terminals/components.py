from collections.abc import Callable

from gi.repository import Adw, Gtk

from ...api.types import Project
from ...widgets.badges import StatusBadge
from ...widgets.icon import Icon
from ...widgets.text import Text
from .labels import LAUNCH, ROW_ACTIONS, WORKSPACE
from .model import RowModel


class SessionRow(Gtk.ListBoxRow):
    def __init__(self, model: RowModel, on_delete: Callable[[str], None]) -> None:
        super().__init__(css_classes=["to-terminal-row"])
        content = Gtk.Box(spacing=10)
        self._icon = Icon(model.icon, "sm")
        self._icon.set_valign(Gtk.Align.START)
        self._icon.set_margin_top(2)
        self._icon.add_css_class("to-terminal-row-icon")
        titles = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6, hexpand=True, css_classes=["to-terminal-row-text"])
        heading = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        self._title = Text(model.title, "label", lines=1)
        self._subtitle = Text(model.subtitle, "caption", "textSecondary", lines=1)
        heading.append(self._title)
        heading.append(self._subtitle)
        self._badge = StatusBadge(model.status, model.tone)
        titles.append(heading)
        titles.append(self._badge)
        self._delete = Gtk.Button(
            child=Icon("delete", "sm"), valign=Gtk.Align.START, css_classes=["flat", "to-terminal-row-delete"]
        )
        self._delete.connect("clicked", lambda *_: on_delete(self.terminal_id))
        content.append(self._icon)
        content.append(titles)
        content.append(self._delete)
        self.set_child(content)
        self.model = model
        self.update(model)

    @property
    def terminal_id(self) -> str:
        return self.model.id

    def update(self, model: RowModel) -> None:
        self.model = model
        self._icon.set_icon(model.icon)
        self._title.set_label(model.title)
        self._subtitle.set_text_value(model.subtitle)
        self._badge.update(model.status, model.tone)
        label = ROW_ACTIONS["delete_running"] if model.running else ROW_ACTIONS["delete"]
        self._delete.set_tooltip_text(label)
        self._delete.update_property([Gtk.AccessibleProperty.LABEL], [label])
        if model.running:
            self.remove_css_class("to-terminal-row-ended")
        else:
            self.add_css_class("to-terminal-row-ended")


class LaunchButton(Gtk.Box):
    def __init__(self, label: str, icon_name: str, tooltip: str, on_launch: Callable[[str | None], None]) -> None:
        super().__init__(css_classes=["to-terminal-launch"], valign=Gtk.Align.CENTER)
        content = Gtk.Box(spacing=6)
        content.append(Icon(icon_name, "sm"))
        content.append(Gtk.Label(label=label))
        self._button = Adw.SplitButton(
            child=content, tooltip_text=tooltip, dropdown_tooltip=LAUNCH["picker_tooltip"], hexpand=True
        )
        self.append(self._button)
        self._on_launch = on_launch
        self._button.connect("clicked", lambda *_: on_launch(None))
        self._list = Gtk.ListBox(selection_mode=Gtk.SelectionMode.NONE, css_classes=["to-terminal-picker"])
        self._list.connect("row-activated", self._activated)
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6, margin_top=6, margin_bottom=6, margin_start=6, margin_end=6)
        box.append(Text(LAUNCH["picker_title"], "overline", "textTertiary"))
        scroller = Gtk.ScrolledWindow(
            child=self._list, hscrollbar_policy=Gtk.PolicyType.NEVER, propagate_natural_height=True, max_content_height=360
        )
        box.append(scroller)
        self._popover = Gtk.Popover(child=box)
        self._button.set_popover(self._popover)
        self.set_projects(None)

    def set_projects(self, projects: list[Project] | None) -> None:
        while (child := self._list.get_first_child()) is not None:
            self._list.remove(child)
        self._list.append(self._row(WORKSPACE, None, "sandbox"))
        if projects is None:
            loading = Gtk.ListBoxRow(activatable=False, selectable=False)
            loading.set_child(Text(LAUNCH["loading_projects"], "caption", "textSecondary"))
            self._list.append(loading)
            return
        for project in projects:
            self._list.append(self._row(project.get("name") or project["id"], project["id"], "project"))

    def _row(self, label: str, project_id: str | None, icon_name: str) -> Gtk.ListBoxRow:
        row = Gtk.ListBoxRow()
        content = Gtk.Box(spacing=8, margin_top=6, margin_bottom=6, margin_start=6, margin_end=12)
        content.append(Icon(icon_name, "sm"))
        content.append(Text(label, "label"))
        row.set_child(content)
        row.project_id = project_id
        return row

    def _activated(self, _list: Gtk.ListBox, row: Gtk.ListBoxRow) -> None:
        if not hasattr(row, "project_id"):
            return
        self._popover.popdown()
        self._on_launch(row.project_id)
