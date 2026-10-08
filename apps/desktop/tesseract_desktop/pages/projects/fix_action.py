from collections.abc import Callable
from typing import TYPE_CHECKING, Any

from ...api.client import ControllerClient

if TYPE_CHECKING:
    from .detail import ProjectDetail


class FixWithAi:
    """Hands a failed run to the agent: fetches the tail of its log and opens a new chat for the
    project with a prompt describing the failure, so the user can add context before sending."""

    def __init__(self, host: "ProjectDetail", on_change: Callable[[], None]) -> None:
        self._host = host
        self._on_change = on_change
        self._pending: set[str] = set()

    def is_pending(self, item_id: str) -> bool:
        return item_id in self._pending

    def open(
        self,
        item_id: str,
        fetch_lines: Callable[[ControllerClient], list[dict[str, Any]]],
        to_prompt: Callable[[list[dict[str, Any]]], str],
    ) -> None:
        if item_id in self._pending:
            return
        self._pending.add(item_id)
        self._on_change()

        def done() -> None:
            self._pending.discard(item_id)
            self._on_change()

        def loaded(lines: list[dict[str, Any]]) -> None:
            prompt = to_prompt(list(lines or []))
            self._host.ctx.navigate("agents", {"new": True, "projectId": self._host.project_id, "prompt": prompt})

        self._host.ctx.call(fetch_lines, loaded, self._host.report, done)
