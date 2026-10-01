from typing import TYPE_CHECKING

from gi.repository import Gtk

from ...api.types import AgentRun
from ...widgets.keyed_list import KeyedList
from ...widgets.record_row import RecordRow, RowAction
from ...widgets.section import Section
from .labels import CONVERSATIONS
from .model import project_runs, run_meta, run_state, run_title

if TYPE_CHECKING:
    from .detail import ProjectDetail


class ConversationsTab:
    def __init__(self, host: "ProjectDetail") -> None:
        self._host = host
        self.runs: list[AgentRun] = []
        self.widget = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self._list = KeyedList(lambda: RecordRow("agents"), self._update)
        self._section = Section(
            CONVERSATIONS["list"], self._list, CONVERSATIONS["new"], host.ask_claude, CONVERSATIONS["list_empty"]
        )
        self.widget.append(self._section)

    def render(self, runs: list[AgentRun] | None) -> None:
        if runs is None:
            self._section.set_loading(True)
            return
        self._section.set_loading(False)
        self.runs = project_runs(runs, self._host.project_id)
        self._list.sync((run["id"], run) for run in self.runs)
        self._section.set_empty(not self.runs)

    def _update(self, row: RecordRow, run: AgentRun) -> None:
        label, tone = run_state(run)
        row.set_content(run_title(run), None, run_meta(run))
        row.set_status(label, tone)
        row.set_actions([RowAction("open", "forward", CONVERSATIONS["open"], lambda: self._open(run))])
        row.set_on_activate(lambda: self._open(run))

    def _open(self, run: AgentRun) -> None:
        self._host.ctx.navigate("agents", {"runId": run["id"]})
