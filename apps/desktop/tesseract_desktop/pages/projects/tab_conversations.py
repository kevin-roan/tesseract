from collections.abc import Callable
from typing import TYPE_CHECKING

from gi.repository import Gtk

from ...api.types import AgentRun, ClaudeSession
from ...widgets.keyed_list import KeyedList
from ...widgets.record_row import RecordRow, RowAction
from ...widgets.list_view import ListGroup
from .labels import CONVERSATIONS
from .model import session_meta, session_state, session_title

if TYPE_CHECKING:
    from .detail import ProjectDetail


class ConversationsTab:
    def __init__(self, host: "ProjectDetail") -> None:
        self._host = host
        self.sessions: list[ClaudeSession] = []
        self._runs: list[AgentRun] | None = None
        self.widget = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self._list = KeyedList(lambda: RecordRow("agents"), self._update)
        self._list.add_css_class("divided")
        self._section = ListGroup(
            CONVERSATIONS["list"], self._list, CONVERSATIONS["new"], host.ask_claude, CONVERSATIONS["list_empty"], icon="agents"
        )
        self.widget.append(self._section)

    def render(self, sessions: list[ClaudeSession] | None, runs: list[AgentRun] | None) -> None:
        if sessions is None:
            self._section.set_loading(True)
            return
        self._section.set_loading(False)
        self.sessions = sessions
        self._runs = runs
        self._list.sync((session["sessionId"], session) for session in sessions)
        self._section.set_empty(not sessions)
        self._section.set_count(len(sessions))

    def _update(self, row: RecordRow, session: ClaudeSession) -> None:
        label, tone = session_state(session, self._runs)
        row.set_content(session_title(session), session.get("preview"), session_meta(session))
        row.set_status(label, tone, glyph=True)
        target = self._target(session)
        row.set_actions([RowAction("open", "forward", CONVERSATIONS["open"], target)] if target else [])
        row.set_on_activate(target)

    def _target(self, session: ClaudeSession) -> Callable[[], None] | None:
        navigate = self._host.ctx.navigate
        if session.get("agentRunId"):
            return lambda: navigate("agents", {"runId": session["agentRunId"]})
        if session.get("terminalId"):
            return lambda: navigate("terminals", {"terminalId": session["terminalId"]})
        return None
