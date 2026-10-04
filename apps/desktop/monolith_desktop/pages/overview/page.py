from gi.repository import Gtk

from ...api.types import InboxCounts, SandboxStatus
from ...store import ConnectionState
from ...viewmodels import EmptyModel
from ...services.connection_view import connection_label, connection_tone
from ...widgets import (
    ChipGroup,
    EmptyState,
    HeaderAction,
    KeyValueList,
    Notice,
    PageBody,
    ScreenHeader,
    Section,
    StatGrid,
    StatusBadge,
    Surface,
)
from ...widgets.charts.legend import SeriesLegend
from ...widgets.charts.timeseries import TimeSeriesChart
from ...widgets.motion import crossfade_stack
from ..base import Page
from . import model
from .labels import HISTORY, REFRESH, SECTIONS, TITLE


class OverviewPage(Page):
    id = "overview"
    title = TITLE
    icon = "overview"
    section = "sandbox"
    order = 0

    def build(self) -> Gtk.Widget:
        store = self.ctx.store
        self._stack = crossfade_stack()

        self._empty = EmptyState("")
        self._stack.add_named(self._empty, "empty")

        body = PageBody()
        self._badge = StatusBadge("")
        self._header = ScreenHeader(
            TITLE,
            accessory=self._badge,
            actions=[HeaderAction("refresh", "refresh", REFRESH, self.ctx.connection.refresh)],
        )
        body.append(self._header)

        self._notice = Notice("")
        self._notice.set_visible(False)
        body.append(self._notice)

        self._resources = StatGrid()
        body.append(Section(SECTIONS["resources"], self._resources))

        body.append(self._build_history())

        self._counts = StatGrid(min_columns=2, max_columns=5)
        body.append(Section(SECTIONS["activity"], self._counts))

        columns = Gtk.Box(spacing=24, homogeneous=True)
        self._display = KeyValueList()
        display_card = Surface()
        display_card.append(self._display)
        columns.append(Section(SECTIONS["display"], display_card))
        self._tools = KeyValueList(monospace=True)
        tools_card = Surface()
        tools_card.append(self._tools)
        self._tools_section = Section(SECTIONS["tools"], tools_card, empty_label=SECTIONS["tools_empty"])
        columns.append(self._tools_section)
        body.append(columns)

        self._stack.add_named(body, "content")

        store.connection.bind(self._stack, self._render_connection)
        store.status.bind(self._stack, self._render_status)
        store.inbox.bind(self._stack, self._render_inbox)
        self.ctx.metrics.revision.bind(self._stack, lambda _revision: self._render_history())
        return self._stack

    def _build_history(self) -> Gtk.Widget:
        self._range = model.DEFAULT_RANGE
        self._legend = SeriesLegend(model.legend_items(), self._set_hidden)
        self._chart = TimeSeriesChart(
            model.range_seconds(self._range),
            height=model.CHART_HEIGHT,
            empty_label=HISTORY["collecting"],
            now_label=HISTORY["now"],
            missing_label=HISTORY["missing"],
            clock=self.ctx.metrics.now,
        )
        self._chart.set_hidden(model.default_hidden())
        self._chart.set_threshold(model.load_threshold())
        card = Surface()
        card.add_css_class("to-resource-history")
        card.append(self._legend)
        card.append(self._chart)
        section = Section(HISTORY["title"], card, subtitle=HISTORY["subtitle"])
        section.header.add_trailing(ChipGroup(model.range_options(), self._range, self._set_range))
        return section

    def _set_range(self, range_id: str) -> None:
        self._range = range_id
        self._chart.set_duration(model.range_seconds(range_id))
        self._render_summaries()

    def _set_hidden(self, hidden: set[str]) -> None:
        self._chart.set_hidden(hidden)

    def _render_history(self) -> None:
        self._chart.set_series(model.chart_series(self.ctx.metrics.samples))
        self._render_summaries()

    def _render_summaries(self) -> None:
        metrics = self.ctx.metrics
        start = metrics.now() - model.range_seconds(self._range)
        for key, (value, caption) in model.series_summaries(metrics.samples, start).items():
            self._legend.update(key, value, caption)

    def _render_connection(self, state: ConnectionState) -> None:
        self._badge.update(connection_label(state), connection_tone(state))
        self._sync_view(self.ctx.store.status.value, state)

    def _sync_view(self, status: SandboxStatus | None, state: ConnectionState) -> None:
        self._header.set_title(model.title(status, state))
        if status is not None:
            self._stack.set_visible_child_name("content")
            return
        empty = model.empty_model(state) or model.empty_model(state.with_(status="connecting"))
        if empty is not None:
            self._show_empty(empty)

    def _show_empty(self, empty: EmptyModel) -> None:
        self._empty.set_content(
            empty.title,
            empty.message,
            empty.icon,
            empty.loading,
            empty.action_label,
            (lambda: self._run(empty.action)) if empty.action else None,
            empty.secondary_label,
            (lambda: self._run(empty.secondary)) if empty.secondary else None,
        )
        self._stack.set_visible_child_name("empty")

    def _run(self, action: str | None) -> None:
        if action == "retry":
            self.ctx.connection.refresh()
        elif action == "rediscover":
            self.ctx.connection.rediscover()
        elif action == "preferences":
            self.ctx.open_preferences()
        elif action:
            self.ctx.navigate(action)

    def _render_status(self, status: SandboxStatus | None) -> None:
        self._sync_view(status, self.ctx.store.connection.value)
        if status is None:
            return
        self._header.set_subtitle(model.subtitle(status))
        self._resources.set_items(model.resource_items(status))
        self._counts.set_items(model.count_items(status, self.ctx.navigate))
        self._display.set_rows(model.display_rows(status))
        tools = model.tool_rows(status)
        self._tools.set_rows(tools)
        self._tools_section.set_empty(not tools)

    def _render_inbox(self, inbox: InboxCounts) -> None:
        notice = model.attention_notice(inbox)
        self._notice.set_visible(notice is not None)
        if notice:
            self._notice.update(notice.message, notice.title, notice.tone)
            self._notice.set_action(notice.action_label, lambda: self._run(notice.action))
