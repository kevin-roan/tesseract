from collections.abc import Callable, Mapping
from typing import TYPE_CHECKING

from gi.repository import Adw, GLib, Gtk

from ...api.errors import describe_error
from ...api.types import AgentRun, InboxItem, run_total_tokens
from ...theme.tone import Tone
from ...util.format import format_tokens, join_meta
from ...widgets.badges import StatusBadge
from ...widgets.buttons import ActionButton, IconButton
from ...widgets.code_block import copy_to_clipboard
from ...widgets.composer import Composer
from ...widgets.conversation import (
    AssistantMessage,
    OutcomeCard,
    SystemLine,
    ThinkingRow,
    TimelineView,
    ToolCallCard,
    UserBubble,
)
from ...widgets.feedback import EmptyState, Notice
from ...widgets.icon import Icon
from ...widgets.motion import crossfade_stack
from ...widgets.text import Text
from ..projects.labels import SYNC
from ..projects.sync_actions import SyncActions
from . import model
from .feed import LinkState, RunFeed
from .labels import ATTENTION, CONVERSATION, MANAGE
from .timeline import TimelineItem, build_timeline, same_prefix

if TYPE_CHECKING:
    from ...context import AppContext

TICK_MS = 1000
COMPOSER_WIDTH = 820
TOOL_LABELS = {"input": CONVERSATION["tool_input"], "output": CONVERSATION["tool_output"]}
OUTCOMES = {
    "succeeded": (CONVERSATION["result_done"], "success", "success"),
    "failed": (CONVERSATION["result_failed"], "danger", "close"),
    "cancelled": (CONVERSATION["result_cancelled"], "neutral", "stop"),
}


class ConversationPane(Gtk.Box):
    def __init__(
        self,
        ctx: "AppContext",
        on_follow_up: Callable[[str, AgentRun], None],
        on_select_run: Callable[[str], None],
        on_mark_read: Callable[[InboxItem], None],
        on_open_notice: Callable[[InboxItem], None],
        on_run_changed: Callable[[AgentRun], None],
        on_manage: Callable[[str, str], None],
    ) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, css_classes=["to-conversation"])
        self._ctx = ctx
        self._on_follow_up = on_follow_up
        self._on_select_run = on_select_run
        self._on_mark_read = on_mark_read
        self._on_open_notice = on_open_notice
        self._on_run_changed = on_run_changed
        self._on_manage = on_manage
        self._names: Mapping[str, str] = {}
        self._runs: list[AgentRun] = []
        self._attention: list[InboxItem] = []
        self._sessions: list[Mapping] = []
        self._keys: list[str] = []
        self._widgets: dict[str, tuple[TimelineItem, Gtk.Widget]] = {}
        self._link: LinkState = "idle"
        self._load_error: str | None = None
        self._tick_source: int | None = None
        self._previous_id: str | None = None
        self._notice_error: str | None = None
        self._sync_notice: tuple[str, Tone] | None = None
        self._sync_running = False
        self._feed = RunFeed(ctx, self._run_updated, self._render_timeline, self._link_changed, self._load_failed)

        self.append(self._build_header())
        self._notices = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8, css_classes=["to-convo-notices"])
        self.append(self._notices)

        self._stack = crossfade_stack(vexpand=True)
        self._stack.add_named(EmptyState(CONVERSATION["loading"], loading=True), "loading")
        self._error = EmptyState(CONVERSATION["load_failed_title"], icon="warning", action_label=CONVERSATION["retry"], on_action=self._feed.reload)
        self._stack.add_named(self._error, "error")
        self._timeline = TimelineView(CONVERSATION["jump"])
        self._thinking = ThinkingRow(CONVERSATION["waiting"])
        self._timeline.set_footer([self._thinking])
        self._stack.add_named(self._timeline, "timeline")
        self.append(self._stack)

        self._composer = Composer(
            CONVERSATION["follow_up_placeholder"], CONVERSATION["follow_up_send"], self._follow_up, max_height=200
        )
        clamp = Adw.Clamp(maximum_size=COMPOSER_WIDTH, tightening_threshold=COMPOSER_WIDTH, child=self._composer)
        footer = Gtk.Box(css_classes=["to-convo-footer"])
        clamp.set_hexpand(True)
        footer.append(clamp)
        self.append(footer)

        self.connect("map", lambda *_: self.resume())
        self.connect("unmap", lambda *_: self.pause())

    @property
    def run_id(self) -> str | None:
        return self._feed.run_id

    @property
    def run(self) -> AgentRun | None:
        return self._feed.run

    def show(self, run_id: str, run: AgentRun | None = None) -> None:
        if run_id == self._feed.run_id:
            if run is not None:
                self.update_run(run)
            if self.get_mapped():
                self._feed.resume()
            return
        self._timeline.clear()
        self._keys = []
        self._widgets = {}
        self._load_error = None
        self._composer.clear()
        self._composer.set_busy(False)
        self._notice_error = None
        self._feed.select(run_id, run)
        if self.get_mapped():
            self._feed.resume()
        self._render_all()
        self._timeline.jump_to_end()

    def update_run(self, run: AgentRun) -> None:
        current = self._feed.run
        if run["id"] != self._feed.run_id or current == run:
            return
        if current is not None and current["state"] != "running" and run["state"] == "running":
            return
        self._feed.run = {**(current or {}), **run}
        self._run_updated(self._feed.run, notify=False)

    def set_context(self, names: Mapping[str, str], runs: list[AgentRun], attention: list[InboxItem], sessions: list[Mapping]) -> None:
        self._names = names
        self._runs = runs
        self._attention = attention
        self._sessions = sessions
        self._render_header()
        self._render_notices()
        self._render_previous()

    def pause(self) -> None:
        self._feed.stop()
        self._stop_tick()

    def resume(self) -> None:
        if self._feed.run_id is None:
            return
        self._feed.resume()
        self._sync_tick()

    def follow_up_finished(self, error: str | None) -> None:
        self._composer.set_busy(False)
        if error is None:
            self._composer.clear()
        self._show_error_notice(error)

    def _build_header(self) -> Gtk.Widget:
        header = Gtk.Box(spacing=12, css_classes=["to-convo-header"])
        titles = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6, hexpand=True)
        self._title = Text("", "h4", wrap=True, lines=2)
        titles.append(self._title)
        meta = Gtk.Box(spacing=8)
        self._badge = StatusBadge("")
        meta.append(self._badge)
        self._meta = Text("", "caption", "textSecondary", wrap=True, lines=2)
        self._meta.set_hexpand(True)
        meta.append(self._meta)
        titles.append(meta)
        header.append(titles)
        actions = Gtk.Box(spacing=4, valign=Gtk.Align.CENTER)
        self._terminal_button = ActionButton(CONVERSATION["open_terminal"], self._open_terminal, "secondary", "terminal")
        actions.append(self._terminal_button)
        actions.append(self._build_sync_menu())
        self._copy_button = IconButton("copy", CONVERSATION["copy_session"], self._copy_session)
        actions.append(self._copy_button)
        self._reload_button = IconButton("refresh", CONVERSATION["reload"], lambda: self._feed.reload())
        actions.append(self._reload_button)
        self._archive_button = IconButton("archive", MANAGE["archive"], lambda: self._manage("archive"))
        actions.append(self._archive_button)
        self._unarchive_button = IconButton("unarchive", MANAGE["unarchive"], lambda: self._manage("unarchive"))
        actions.append(self._unarchive_button)
        self._delete_button = IconButton("delete", MANAGE["delete_tooltip"], lambda: self._manage("delete"))
        actions.append(self._delete_button)
        self._cancel_button = ActionButton(CONVERSATION["cancel"], self._confirm_cancel, "destructive", "stop", CONVERSATION["cancel_tooltip"])
        actions.append(self._cancel_button)
        header.append(actions)
        return header

    def _build_sync_menu(self) -> Gtk.Widget:
        items = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6, margin_top=6, margin_bottom=6, margin_start=6, margin_end=6)
        popover = Gtk.Popover(child=items, has_arrow=False)
        self._sync = SyncActions(self._ctx, self, on_report=self._show_sync_notice, on_activate=popover.popdown)
        for button in self._sync.buttons.values():
            button.set_halign(Gtk.Align.FILL)
            items.append(button)
        self._sync_button = ActionButton(SYNC["menu"], lambda: self._open_sync_menu(popover), "secondary", "sync")
        popover.set_parent(self._sync_button)
        return self._sync_button

    def _open_sync_menu(self, popover: Gtk.Popover) -> None:
        self._sync.render()
        self._sync.refresh()
        popover.popup()

    def _show_sync_notice(self, message: str, tone: Tone) -> None:
        self._sync_notice = (message, tone)
        self._render_notices()

    def _clear_sync_notice(self) -> None:
        self._sync_notice = None
        self._render_notices()

    def _run_updated(self, run: AgentRun, notify: bool = True) -> None:
        if notify:
            self._on_run_changed(run)
        self._load_error = None
        self._render_all()

    def _render_all(self) -> None:
        self._render_header()
        self._render_notices()
        self._render_previous()
        self._render_timeline()
        self._render_composer()
        self._sync_tick()

    def _render_header(self) -> None:
        run = self._feed.run
        running = run is not None and run["state"] == "running"
        self._title.set_label(model.run_title(run.get("prompt")) if run else "")
        if run:
            self._badge.update(model.state_label(run["state"]), model.state_tone(run["state"]), running)
            self._badge.set_visible(True)
            session = run.get("sessionId")
            session_label = CONVERSATION["session"].format(id=model.short_id(session)) if session else None
            self._meta.set_label(join_meta(model.header_meta(run, self._names), session_label))
        else:
            self._badge.set_visible(False)
            self._meta.set_label("")
        self._cancel_button.set_visible(running)
        self._copy_button.set_visible(bool(run and run.get("sessionId")))
        if run and run.get("sessionId"):
            self._copy_button.set_tooltip_text(f"{CONVERSATION['copy_session']} · {run['sessionId']}")
        self._reload_button.set_visible(run is not None and not running)
        manageable = model.can_manage(run)
        self._archive_button.set_visible(manageable and not model.is_archived(run))
        self._unarchive_button.set_visible(manageable and model.is_archived(run))
        self._delete_button.set_visible(manageable)
        self._terminal_button.set_visible(model.terminal_for_run(run, self._sessions) is not None)
        project_id = run.get("projectId") if run else None
        if project_id != self._sync.project_id:
            self._sync_notice = None
            self._sync.set_project(project_id)
        elif self._sync_running and not running:
            self._sync.refresh()
        self._sync_running = running
        self._sync_button.set_visible(project_id is not None)

    def _render_notices(self) -> None:
        while (child := self._notices.get_first_child()) is not None:
            self._notices.remove(child)
        run = self._feed.run
        if self._link == "reconnecting":
            self._notices.append(Notice(CONVERSATION["reconnecting"], tone="warning"))
        elif self._link == "polling":
            self._notices.append(Notice(CONVERSATION["polling"], tone="info"))
        if self._notice_error:
            error = Notice(self._notice_error, tone="danger")
            error.set_action(CONVERSATION["dismiss"], lambda: self._show_error_notice(None))
            self._notices.append(error)
        if self._sync_notice:
            message, tone = self._sync_notice
            notice = Notice(message, tone=tone)
            notice.set_action(CONVERSATION["dismiss"], self._clear_sync_notice)
            self._notices.append(notice)
        if run is not None:
            for item in model.attention_for_run(run, self._attention):
                icon, tone = model.notice_style(item)
                notice = Notice(item.get("body") or "", item["title"], tone, icon)
                if model.is_file_item(item):
                    notice.set_action(ATTENTION["download"], lambda i=item: self._on_open_notice(i))
                else:
                    notice.set_action(ATTENTION["mark_read"], lambda i=item: self._on_mark_read(i))
                self._notices.append(notice)
        self._notices.set_visible(self._notices.get_first_child() is not None)

    def _show_error_notice(self, message: str | None) -> None:
        self._notice_error = message
        self._render_notices()

    def _render_previous(self) -> None:
        run = self._feed.run
        previous = model.previous_run(run, self._runs) if run else None
        previous_id = previous["id"] if previous else None
        if previous_id == self._previous_id:
            return
        self._previous_id = previous_id
        if previous is None:
            self._timeline.set_header(None)
            return
        button = Gtk.Button(css_classes=["flat", "to-previous-turn"], halign=Gtk.Align.CENTER)
        content = Gtk.Box(spacing=6)
        content.append(Icon("back", "xs", "textTertiary"))
        content.append(Text(CONVERSATION["continues"].format(title=model.run_title(previous.get("prompt"), 60)), "caption", "textSecondary"))
        button.set_child(content)
        button.connect("clicked", lambda *_, rid=previous["id"]: self._on_select_run(rid))
        self._timeline.set_header(button)

    def _render_timeline(self) -> None:
        run = self._feed.run
        if run is None:
            self._stack.set_visible_child_name("error" if self._load_error else "loading")
            return
        self._stack.set_visible_child_name("timeline")
        items = build_timeline(run, self._feed.log.ordered())
        keys = [item.key for item in items]
        if not same_prefix(self._keys, keys):
            self._timeline.clear()
            self._widgets = {}
        for item in items:
            entry = self._widgets.get(item.key)
            if entry is None:
                widget = self._create(item)
                self._timeline.append(widget)
                self._widgets[item.key] = (item, widget)
            elif entry[0] != item:
                self._update(entry[1], item)
                self._widgets[item.key] = (item, entry[1])
        self._keys = keys
        self._thinking.set_visible(run["state"] == "running")

    def _create(self, item: TimelineItem) -> Gtk.Widget:
        if item.kind == "prompt":
            return UserBubble(item.text)
        if item.kind == "text":
            return AssistantMessage(item.text, copy_label=CONVERSATION["copy_code"], copied_label=CONVERSATION["code_copied"])
        if item.kind == "tool":
            return ToolCallCard(item.tool, item.text, item.result, item.status, TOOL_LABELS)
        if item.kind == "system":
            return SystemLine(item.text)
        return OutcomeCard(*self._outcome_args(item))

    def _update(self, widget: Gtk.Widget, item: TimelineItem) -> None:
        if isinstance(widget, (UserBubble, AssistantMessage, SystemLine)):
            widget.set_text(item.text)
        elif isinstance(widget, ToolCallCard):
            widget.update(item.tool, item.text, item.result, item.status)
        elif isinstance(widget, OutcomeCard):
            widget.update(*self._outcome_args(item))

    def _outcome_args(self, item: TimelineItem) -> tuple:
        title, tone, icon = OUTCOMES.get(item.state, OUTCOMES["cancelled"])
        run = self._feed.run or {}
        meta = join_meta(model.run_duration(run) if run else None, format_tokens(run_total_tokens(run)))
        error = item.error if item.state == "failed" else None
        return title, meta, tone, icon, item.text or None, error

    def _render_composer(self) -> None:
        state = model.follow_up_state(self._feed.run)
        if state == "running":
            self._composer.set_locked(CONVERSATION["follow_up_running"])
        elif state == "no_session":
            self._composer.set_locked(CONVERSATION["follow_up_no_session"])
        else:
            self._composer.set_locked(None)

    def _link_changed(self, link: LinkState) -> None:
        if link == self._link:
            return
        self._link = link
        self._render_notices()

    def _load_failed(self, message: str) -> None:
        self._load_error = message
        self._error.set_content(
            CONVERSATION["load_failed_title"], message, "warning", False, CONVERSATION["retry"], self._feed.reload
        )
        self._render_timeline()

    def _follow_up(self, prompt: str) -> None:
        run = self._feed.run
        if run is None or model.follow_up_state(run) != "ready":
            return
        self._composer.set_busy(True)
        self._on_follow_up(prompt, run)

    def _confirm_cancel(self) -> None:
        run = self._feed.run
        if run is None:
            return
        dialog = Adw.AlertDialog(heading=CONVERSATION["cancel_confirm_title"], body=CONVERSATION["cancel_confirm_body"])
        dialog.add_response("keep", CONVERSATION["cancel_confirm_no"])
        dialog.add_response("stop", CONVERSATION["cancel_confirm_yes"])
        dialog.set_response_appearance("stop", Adw.ResponseAppearance.DESTRUCTIVE)
        dialog.set_default_response("keep")
        dialog.set_close_response("keep")
        dialog.connect("response", lambda _d, response, rid=run["id"]: self._cancel(rid) if response == "stop" else None)
        dialog.present(self.get_root())

    def _cancel(self, run_id: str) -> None:
        self._cancel_button.set_sensitive(False)

        def done() -> None:
            self._cancel_button.set_sensitive(True)

        def ok(run: AgentRun) -> None:
            if run_id == self._feed.run_id:
                self.update_run(run)
                self._on_run_changed(run)

        def failed(error: BaseException) -> None:
            self._show_error_notice(CONVERSATION["cancel_failed"].format(error=describe_error(error)))

        self._ctx.call(lambda client: client.cancel_agent_run(run_id), ok, failed, done)

    def _manage(self, action: str) -> None:
        run = self._feed.run
        if model.can_manage(run):
            self._on_manage(action, run["id"])

    def _copy_session(self) -> None:
        run = self._feed.run
        if run and run.get("sessionId"):
            copy_to_clipboard(self, run["sessionId"])
            self._ctx.toast(CONVERSATION["copied"])

    def _open_terminal(self) -> None:
        terminal_id = model.terminal_for_run(self._feed.run, self._sessions)
        if terminal_id:
            self._ctx.navigate("terminals", {"terminalId": terminal_id})

    def _sync_tick(self) -> None:
        run = self._feed.run
        if run is not None and run["state"] == "running" and self.get_mapped():
            if self._tick_source is None:
                self._tick_source = GLib.timeout_add(TICK_MS, self._tick)
        else:
            self._stop_tick()

    def _tick(self) -> bool:
        run = self._feed.run
        if run is None or run["state"] != "running":
            self._tick_source = None
            return GLib.SOURCE_REMOVE
        self._render_header()
        return GLib.SOURCE_CONTINUE

    def _stop_tick(self) -> None:
        if self._tick_source is not None:
            GLib.source_remove(self._tick_source)
            self._tick_source = None
