from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from typing import Literal

from ...api.types import AgentRun, AgentRunEvent

ItemKind = Literal["prompt", "text", "tool", "system", "outcome"]
ToolStatus = Literal["pending", "ok", "error", "unknown"]


@dataclass(frozen=True)
class TimelineItem:
    key: str
    kind: ItemKind
    text: str = ""
    tool: str = ""
    result: str | None = None
    status: ToolStatus = "unknown"
    state: str = ""
    error: str | None = None


class EventLog:
    def __init__(self) -> None:
        self._events: dict[int, AgentRunEvent] = {}

    def __len__(self) -> int:
        return len(self._events)

    def clear(self) -> None:
        self._events.clear()

    def add(self, event: Mapping) -> bool:
        seq = event.get("seq")
        if not isinstance(seq, int) or event.get("kind") not in ("text", "tool_use", "tool_result", "system"):
            return False
        if self._events.get(seq) == event:
            return False
        self._events[seq] = dict(event)  # type: ignore[assignment]
        return True

    def extend(self, events: Iterable[Mapping]) -> bool:
        changed = False
        for event in events:
            changed = self.add(event) or changed
        return changed

    def ordered(self) -> list[AgentRunEvent]:
        return [self._events[seq] for seq in sorted(self._events)]


def _tool_name(event: Mapping) -> str:
    return str(event.get("tool") or "")


def build_timeline(run: AgentRun | None, events: Iterable[AgentRunEvent]) -> list[TimelineItem]:
    items: list[TimelineItem] = []
    if run is not None:
        items.append(TimelineItem("prompt", "prompt", run.get("prompt") or ""))
    running = run is not None and run["state"] == "running"
    open_tools: list[int] = []
    for event in events:
        kind = event.get("kind")
        seq = event.get("seq")
        if kind == "text":
            text = event.get("text") or ""
            previous = items[-1] if items else None
            if previous is not None and previous.kind == "text":
                items[-1] = TimelineItem(previous.key, "text", f"{previous.text}\n\n{text}")
            elif text.strip():
                items.append(TimelineItem(f"text-{seq}", "text", text))
        elif kind == "tool_use":
            open_tools.append(len(items))
            items.append(TimelineItem(f"tool-{seq}", "tool", event.get("summary") or "", _tool_name(event), None, "pending"))
        elif kind == "tool_result":
            status: ToolStatus = "error" if event.get("isError") else "ok"
            name = _tool_name(event)
            index = next((i for i in open_tools if not name or items[i].tool == name), None)
            if index is None:
                items.append(TimelineItem(f"result-{seq}", "tool", "", name, event.get("summary") or "", status))
                continue
            open_tools.remove(index)
            use = items[index]
            items[index] = TimelineItem(use.key, "tool", use.text, use.tool, event.get("summary") or "", status)
        elif kind == "system":
            text = (event.get("text") or "").strip()
            if text:
                items.append(TimelineItem(f"system-{seq}", "system", text))
    if not running:
        for index in open_tools:
            use = items[index]
            items[index] = TimelineItem(use.key, "tool", use.text, use.tool, None, "unknown")
    if run is not None and run["state"] != "running":
        last_text = next((item.text for item in reversed(items) if item.kind == "text"), "")
        result = (run.get("result") or "").strip()
        extra = result if result and result not in last_text and result != (run.get("error") or "").strip() else ""
        items.append(TimelineItem(f"outcome-{run['state']}", "outcome", extra, state=run["state"], error=run.get("error")))
    return items


def same_prefix(previous: list[str], current: list[str]) -> bool:
    return current[: len(previous)] == previous
