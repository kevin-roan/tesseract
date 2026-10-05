from gi.repository import Gtk

from ...api.types import InboxCounts, SandboxStatus
from ...store import ConnectionState
from ...viewmodels import EmptyModel
from ...services.connection_view import connection_label, connection_tone
from ...theme.tokens import SPACING
from ...widgets import ChipGroup, EmptyState, Notice, PageBody, Section, StatGrid
from ...widgets.charts.legend import SeriesLegend
from ...widgets.charts.timeseries import TimeSeriesChart
from ...widgets.motion import crossfade_stack
from ..base import Page
from . import model
from .components import ActivityList, FlatList, OverviewHeader
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

        body = PageBody(spacing=SPACING["xl"])
        body.box.add_css_class("to-overview")
        self._header = OverviewHeader(TITLE, REFRESH, self.ctx.connection.refresh)
        body.append(self._header)

        self._notice = Notice("")
        self._notice.set_visible(False)
        body.append(self._notice)

        self._resources = StatGrid()
        body.append(Section(SECTIONS["resources"], self._resources))

        body.append(self._build_history())

        columns = Gtk.Box(spacing=SPACING["2xl"], homogeneous=True)
        self._counts = ActivityList()
        columns.append(Section(SECTIONS["activity"], self._counts))
        self._display = FlatList()
        columns.append(Section(SECTIONS["display"], self._display))
        self._tools = FlatList(monospace=True)
        self._tools_section = Section(SECTIONS["tools"], self._tools, empty_label=SECTIONS["tools_empty"])
        body.append(columns)
        body.append(self._tools_section)

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
        card = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, css_classes=["to-resource-history"])
        card.append(self._legend)
        card.append(self._chart)
        section = Section(HISTORY["title"], card, subtitle=HISTORY["subtitle"])
        ranges = ChipGroup(model.range_options(), self._range, self._set_range)
        ranges.set_max_children_per_line(len(model.range_options()))
        ranges.set_column_spacing(SPACING["xs"] + 2)
        section.header.add_trailing(ranges)
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
        self._header.set_status(connection_label(state, with_name=False), connection_tone(state))
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
        self._header.set_meta(model.subtitle(status))
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
