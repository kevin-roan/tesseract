from collections.abc import Callable, Mapping

from gi.repository import Gio, GLib, Gtk

from ...api.types import AgentRun, InboxItem
from ...theme.icons import resolve_icon
from ...util.format import format_relative_time, join_meta
from ...widgets.action_menu import ActionMenu
from ...widgets.buttons import IconButton
from ...widgets.conversation import Placeholder
from ...widgets.icon import Icon
from ...widgets.motion import revealer
from ...widgets.text import Text
from . import model
from .labels import ATTENTION, FILTERS, LIST, MANAGE
from .rows import AttentionCard, ConversationRow, RowModel, TerminalSessionRow, row_model


class ConversationList(Gtk.Box):
    def __init__(
        self,
        on_select: Callable[[str], None],
        on_new: Callable[[], None],
        on_open_attention: Callable[[InboxItem], None],
        on_mark_read: Callable[[InboxItem], None],
        on_open_terminal: Callable[[str], None],
        on_filter: Callable[[str], None],
        on_action: Callable[[str, str | None], None],
    ) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, css_classes=["to-agents-list"])
        self._on_select = on_select
        self._on_open_attention = on_open_attention
        self._on_mark_read = on_mark_read
        self._on_open_terminal = on_open_terminal
        self._on_filter = on_filter
        self._on_action = on_action
        self._filter = "all"
        self._query = ""
        self._runs: list[AgentRun] | None = None
        self._archived: list[AgentRun] | None = None
        self._names: Mapping[str, str] = {}
        self._attention: list[InboxItem] = []
        self._sessions: list[Mapping] = []
        self._selected: str | None = None
        self._rendered: tuple = ()
        self._rows: dict[str, ConversationRow] = {}

        self.header_buttons = self._build_header_buttons(on_new)
        self._search = Gtk.SearchEntry(placeholder_text=LIST["search"], hexpand=True)
        self._search.connect("search-changed", lambda entry: self._set_query(entry.get_text()))
        self._search.connect("stop-search", lambda *_: self._search_toggle.set_active(False))
        search_row = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8, css_classes=["to-agents-search"])
        search_row.append(self._search)
        self._search_revealer = revealer(child=search_row, transition_type=Gtk.RevealerTransitionType.SLIDE_DOWN)
        self.append(self._search_revealer)

        content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8, css_classes=["to-agents-list-content"])
        content.append(self._build_filter_chip())
        self._attention_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        content.append(self._attention_box)
        self._list = Gtk.ListBox(selection_mode=Gtk.SelectionMode.SINGLE, css_classes=["to-convo-list"])
        self._list.connect("row-activated", lambda _list, row: self._activate(row))
        content.append(self._list)
        self._empty = Placeholder("")
        self._empty.set_margin_top(48)
        content.append(self._empty)
        self._terminals_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        content.append(self._terminals_box)
        self._scroller = Gtk.ScrolledWindow(child=content, hscrollbar_policy=Gtk.PolicyType.NEVER, vexpand=True)
        self.append(self._scroller)
        self._row_menu = ActionMenu()
        self._row_menu.set_parent(self)
        self._sync_filter()
        self._render()

    def _build_header_buttons(self, on_new: Callable[[], None]) -> list[Gtk.Widget]:
        self._search_toggle = Gtk.ToggleButton(child=Icon("search", "sm"), tooltip_text=LIST["search_toggle"], css_classes=["flat"])
        self._search_toggle.update_property([Gtk.AccessibleProperty.LABEL], [LIST["search_toggle"]])
        self._search_toggle.connect("toggled", self._search_toggled)

        actions = Gio.SimpleActionGroup()
        self._filter_action = Gio.SimpleAction.new_stateful(
            "filter", GLib.VariantType.new("s"), GLib.Variant.new_string(self._filter)
        )
        self._filter_action.connect("activate", lambda _action, value: self.show_filter(value.get_string()))
        actions.add_action(self._filter_action)
        menu = Gio.Menu()
        for filter_id, label in FILTERS.items():
            menu.append(label, f"agents-list.filter::{filter_id}")
        self._filter_button = Gtk.MenuButton(
            icon_name=resolve_icon("filter"), tooltip_text=LIST["filter"], menu_model=menu,
            valign=Gtk.Align.CENTER, css_classes=["flat"],
        )
        self._filter_button.insert_action_group("agents-list", actions)
        self._filter_button.update_property([Gtk.AccessibleProperty.LABEL], [LIST["filter"]])

        self._bulk_menu = ActionMenu()
        self._more = Gtk.MenuButton(
            icon_name=resolve_icon("more"), tooltip_text=MANAGE["more"], popover=self._bulk_menu,
            valign=Gtk.Align.CENTER, css_classes=["flat"],
        )
        self._more.update_property([Gtk.AccessibleProperty.LABEL], [MANAGE["more"]])
        self._more.set_create_popup_func(lambda _button: self._bulk_menu.set_entries(self._entries(self._bulk_actions(), None)))
        return [self._search_toggle, self._filter_button, self._more, IconButton("compose", LIST["new"], on_new)]

    def _build_filter_chip(self) -> Gtk.Widget:
        self._filter_chip = Gtk.Button(css_classes=["to-chip", "to-filter-chip"], halign=Gtk.Align.START)
        content = Gtk.Box(spacing=6)
        content.append(Icon("filter", "xs", "textSecondary"))
        self._filter_label = Text("", "caption")
        content.append(self._filter_label)
        content.append(Icon("close", "xs", "textTertiary"))
        self._filter_chip.set_child(content)
        self._filter_chip.set_tooltip_text(LIST["clear_filter"])
        self._filter_chip.connect("clicked", lambda *_: self.show_filter("all"))
        return self._filter_chip

    def set_data(
        self,
        runs: list[AgentRun] | None,
        names: Mapping[str, str],
        attention: list[InboxItem],
        sessions: list[Mapping],
    ) -> None:
        self._runs = runs
        self._names = names
        self._attention = attention
        self._sessions = sessions
        self._render()

    def set_archived(self, runs: list[AgentRun] | None) -> None:
        self._archived = runs
        self._render()

    @property
    def archived_view(self) -> bool:
        return self._filter == model.ARCHIVED_FILTER

    def set_selected(self, run_id: str | None) -> None:
        self._selected = run_id
        row = self._rows.get(run_id or "")
        if row is None:
            self._list.unselect_all()
        elif self._list.get_selected_row() is not row:
            self._list.select_row(row)

    def show_filter(self, filter_id: str) -> None:
        if filter_id in FILTERS and filter_id != self._filter:
            self._set_filter(filter_id)

    def focus_search(self) -> None:
        self._search_toggle.set_active(True)
        GLib.idle_add(self._focus_entry)

    def _focus_entry(self) -> bool:
        self._search.grab_focus()
        return GLib.SOURCE_REMOVE

    def _search_toggled(self, button: Gtk.ToggleButton) -> None:
        active = button.get_active()
        self._search_revealer.set_reveal_child(active)
        if active:
            GLib.idle_add(self._focus_entry)
        elif self._search.get_text():
            self._search.set_text("")

    def refresh_times(self) -> None:
        for row in self._rows.values():
            row.refresh_time()

    def _set_query(self, query: str) -> None:
        self._query = query
        self._render()

    def _set_filter(self, filter_id: str) -> None:
        self._filter = filter_id
        self._sync_filter()
        self._on_filter(filter_id)
        self._render()

    def _sync_filter(self) -> None:
        self._filter_action.set_state(GLib.Variant.new_string(self._filter))
        filtered = self._filter != "all"
        self._filter_label.set_label(FILTERS[self._filter])
        self._filter_chip.set_visible(filtered)

    def _bulk_actions(self) -> tuple[str, ...]:
        return model.bulk_actions(self._runs, self._archived, self.archived_view)

    def _entries(self, actions: tuple[str, ...], run_id: str | None) -> list[list[tuple[str, Callable[[], None]]]]:
        return [
            [(MANAGE[action], lambda a=action: self._on_action(a, run_id)) for action in section]
            for section in model.action_sections(actions)
        ]

    def _open_row_menu(self, row: ConversationRow, x: float, y: float) -> None:
        actions = model.row_actions(row.data.state, self.archived_view)
        if self._row_menu.set_entries(self._entries(actions, row.data.run_id)):
            self._row_menu.popup_at(row, x, y)

    def _activate(self, row: Gtk.ListBoxRow) -> None:
        if isinstance(row, ConversationRow):
            self._selected = row.data.run_id
            self._on_select(row.data.run_id)

    def _render(self) -> None:
        source = self._archived if self.archived_view else self._runs
        runs = source or []
        needs = model.attention_items(self._attention)
        visible = model.filter_runs(runs, self._filter, self._query, self._names, needs)
        rows: list[RowModel] = [
            row_model(run, self._names, model.is_follow_up(run, runs), bool(model.attention_for_run(run, needs)))
            for run in model.sort_recent(visible)
        ]
        attention = self._attention if self._filter not in ("running", model.ARCHIVED_FILTER) else []
        terminals = model.terminal_sessions(self._sessions) if self._filter == "all" else []
        signature = (tuple(rows), tuple(item["id"] for item in attention), tuple(s.get("sessionId") for s in terminals), source is None)
        if signature != self._rendered:
            self._rendered = signature
            self._render_rows(rows)
            self._render_attention(attention)
            self._render_terminals(terminals)
        self._render_empty(source, visible, attention, terminals)
        self._more.set_sensitive(bool(self._bulk_actions()))
        self.set_selected(self._selected)

    def _render_rows(self, rows: list[RowModel]) -> None:
        self._list.remove_all()
        self._rows = {}
        for data in rows:
            row = ConversationRow(data, on_context=self._open_row_menu)
            self._rows[data.run_id] = row
            self._list.append(row)
        self._list.set_visible(bool(rows))

    def _render_attention(self, items: list[InboxItem]) -> None:
        _clear(self._attention_box)
        if not items:
            self._attention_box.set_visible(False)
            return
        self._attention_box.set_visible(True)
        self._attention_box.append(_section_title(LIST["attention"]))
        for item in items:
            opener, label = self._attention_action(item)
            self._attention_box.append(
                AttentionCard(item, model.project_name(item.get("projectId"), self._names) if item.get("projectId") else None,
                              opener, label, self._on_mark_read)
            )

    def _attention_action(self, item: InboxItem) -> tuple[Callable[[InboxItem], None] | None, str]:
        if model.is_file_item(item):
            return self._on_open_attention, ATTENTION["download"]
        if item.get("agentRunId"):
            return self._on_open_attention, ATTENTION["open_run"]
        if item.get("terminalId"):
            return self._on_open_attention, ATTENTION["open_terminal"]
        return None, ""

    def _render_terminals(self, sessions: list[Mapping]) -> None:
        _clear(self._terminals_box)
        self._terminals_box.set_visible(bool(sessions))
        if not sessions:
            return
        self._terminals_box.append(_section_title(LIST["terminals"]))
        for session in sessions:
            title = model.run_title(session.get("title"))
            meta = join_meta(
                model.project_name(session.get("projectId"), self._names),
                format_relative_time(session.get("lastActiveAt")),
                LIST["terminal_active"],
            )
            terminal_id = session["terminalId"]
            self._terminals_box.append(TerminalSessionRow(title, meta, lambda tid=terminal_id: self._on_open_terminal(tid)))

    def _render_empty(self, runs: list[AgentRun] | None, visible: list[AgentRun], attention: list, terminals: list) -> None:
        if runs is None:
            self._empty.set_content(LIST["loading"], loading=True)
            self._empty.set_visible(True)
        elif not runs and self.archived_view:
            self._empty.set_content(LIST["archived_empty_title"])
            self._empty.set_visible(True)
        elif not runs:
            self._empty.set_content(LIST["empty_title"])
            self._empty.set_visible(not attention and not terminals)
        elif not visible:
            self._empty.set_content(LIST["no_match_title"])
            self._empty.set_visible(not attention)
        else:
            self._empty.set_visible(False)


def _section_title(title: str) -> Gtk.Widget:
    label = Text(title, "overline", "textSecondary")
    label.add_css_class("to-agents-group-title")
    return label


def _clear(box: Gtk.Box) -> None:
    while (child := box.get_first_child()) is not None:
        box.remove(child)
