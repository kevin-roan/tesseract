from collections.abc import Callable, Mapping

from gi.repository import Gtk

from ...api.types import AgentRun, InboxItem
from ...theme.icons import resolve_icon
from ...util.format import format_relative_time, join_meta
from ...widgets.action_menu import ActionMenu
from ...widgets.buttons import ActionButton, ChipGroup
from ...widgets.feedback import EmptyState
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
        self._group_titles: dict[str, str] = {}

        top = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10, css_classes=["to-agents-list-top"])
        new_button = ActionButton(LIST["new"], on_new, "primary", "compose")
        new_button.set_hexpand(True)
        top.append(new_button)
        self._search = Gtk.SearchEntry(placeholder_text=LIST["search"], hexpand=True)
        self._search.connect("search-changed", lambda entry: self._set_query(entry.get_text()))
        search_row = Gtk.Box(spacing=6)
        search_row.append(self._search)
        self._bulk_menu = ActionMenu()
        self._more = Gtk.MenuButton(
            icon_name=resolve_icon("more"), tooltip_text=MANAGE["more"], popover=self._bulk_menu,
            valign=Gtk.Align.CENTER, css_classes=["flat"],
        )
        self._more.update_property([Gtk.AccessibleProperty.LABEL], [MANAGE["more"]])
        self._more.set_create_popup_func(lambda _button: self._bulk_menu.set_entries(self._entries(self._bulk_actions(), None)))
        search_row.append(self._more)
        top.append(search_row)
        self._chips = ChipGroup(list(FILTERS.items()), "all", self._set_filter)
        top.append(self._chips)
        self.append(top)

        content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12, css_classes=["to-agents-list-content"])
        self._attention_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        content.append(self._attention_box)
        self._list = Gtk.ListBox(selection_mode=Gtk.SelectionMode.SINGLE, css_classes=["to-convo-list"])
        self._list.set_header_func(self._header)
        self._list.connect("row-activated", lambda _list, row: self._activate(row))
        content.append(self._list)
        self._empty = EmptyState("", None, "agents")
        self._empty.set_margin_top(24)
        content.append(self._empty)
        self._terminals_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
        content.append(self._terminals_box)
        self._scroller = Gtk.ScrolledWindow(child=content, hscrollbar_policy=Gtk.PolicyType.NEVER, vexpand=True)
        self.append(self._scroller)
        self._row_menu = ActionMenu()
        self._row_menu.set_parent(self)
        self._render()

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
        self._chips.select(filter_id)
        self._set_filter(filter_id)

    def focus_search(self) -> None:
        self._search.grab_focus()

    def refresh_times(self) -> None:
        for row in self._rows.values():
            row.refresh_time()

    def _set_query(self, query: str) -> None:
        self._query = query
        self._render()

    def _set_filter(self, filter_id: str) -> None:
        self._filter = filter_id
        self._on_filter(filter_id)
        self._render()

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
        groups = model.group_runs(visible, self._names)
        rows: list[tuple[str, RowModel]] = [
            (
                group.key,
                row_model(
                    run,
                    self._names,
                    model.is_follow_up(run, runs),
                    bool(model.attention_for_run(run, needs)),
                ),
            )
            for group in groups
            for run in group.runs
        ]
        attention = self._attention if self._filter not in ("running", model.ARCHIVED_FILTER) else []
        terminals = model.terminal_sessions(self._sessions) if self._filter == "all" else []
        signature = (tuple(rows), tuple(item["id"] for item in attention), tuple(s.get("sessionId") for s in terminals), source is None)
        if signature != self._rendered:
            self._rendered = signature
            self._group_titles = {group.key: group.title for group in groups}
            self._render_rows(rows)
            self._render_attention(attention)
            self._render_terminals(terminals)
        self._render_empty(source, visible, attention, terminals)
        self._more.set_sensitive(bool(self._bulk_actions()))
        self.set_selected(self._selected)

    def _render_rows(self, rows: list[tuple[str, RowModel]]) -> None:
        self._list.remove_all()
        self._rows = {}
        for key, data in rows:
            row = ConversationRow(data, key, self._open_row_menu)
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
            self._empty.set_content(LIST["loading"], None, None, True)
            self._empty.set_visible(True)
        elif not runs and self.archived_view:
            self._empty.set_content(LIST["archived_empty_title"], LIST["archived_empty_message"], "archive")
            self._empty.set_visible(True)
        elif not runs:
            self._empty.set_content(LIST["empty_title"], LIST["empty_message"], "agents")
            self._empty.set_visible(not attention and not terminals)
        elif not visible:
            self._empty.set_content(LIST["no_match_title"], LIST["no_match_message"], "search")
            self._empty.set_visible(not attention)
        else:
            self._empty.set_visible(False)

    def _header(self, row: Gtk.ListBoxRow, before: Gtk.ListBoxRow | None) -> None:
        key = row.group_key if isinstance(row, ConversationRow) else ""
        if isinstance(before, ConversationRow) and before.group_key == key:
            row.set_header(None)
            return
        label = _section_title(self._group_titles.get(key, ""))
        label.set_margin_top(4 if before is None else 14)
        row.set_header(label)


def _section_title(title: str) -> Gtk.Widget:
    label = Text(title, "overline", "textTertiary")
    label.add_css_class("to-agents-group-title")
    return label


def _clear(box: Gtk.Box) -> None:
    while (child := box.get_first_child()) is not None:
        box.remove(child)

