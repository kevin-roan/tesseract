from collections.abc import Callable, Mapping
from typing import TYPE_CHECKING

from gi.repository import Gtk

from ...api.types import Artifact
from ...widgets.feedback import EmptyState
from ...widgets.list_view import GroupedList
from ...widgets.record_row import RecordRow, RowAction
from .actions import ArtifactActions
from .labels import ARTIFACTS
from .model import artifact_meta, by_project, file_icon, source_badge

if TYPE_CHECKING:
    from ...context import AppContext


class ArtifactList(Gtk.Box):
    """Shared files as Linear rows, grouped by project (or under one `title` band for a single project)."""

    def __init__(
        self,
        ctx: "AppContext",
        title: str,
        empty_label: str,
        report: Callable[[str], None],
        on_deleted: Callable[[str], None],
        show_project: bool = False,
        empty_title: str | None = None,
    ) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self._title = title
        self._show_project = show_project
        self._artifacts: list[Artifact] = []
        self._names: Mapping[str, str] = {}
        self._empty_label = empty_label
        self._empty_title = empty_title or title
        self.actions = ArtifactActions(ctx, report, self._rerender, self._progress, on_deleted)
        self._list = GroupedList(lambda: RecordRow("file"), self._update, icon="project" if show_project else "artifacts")
        self._loading = EmptyState("", loading=True)
        self._empty = EmptyState(self._empty_title, empty_label, "files")
        self._stack = Gtk.Stack(vhomogeneous=False)
        self._stack.add_named(self._loading, "loading")
        self._stack.add_named(self._empty, "empty")
        self._stack.add_named(self._list, "content")
        self.append(self._stack)
        self.connect("map", lambda *_: self.actions.load_taildrop())

    @property
    def artifacts(self) -> list[Artifact]:
        return list(self._artifacts)

    def render(
        self,
        artifacts: list[Artifact] | None,
        names: Mapping[str, str] | None = None,
        empty: tuple[str, str | None] | None = None,
    ) -> None:
        if artifacts is None:
            self._stack.set_visible_child_name("loading")
            return
        self._artifacts = artifacts
        self._names = names or {}
        self._empty.set_content(*(empty or (self._empty_title, self._empty_label)), "files")
        self._rerender()

    def _rerender(self) -> None:
        if self._show_project:
            groups = by_project(self._artifacts, self._names)
        else:
            groups = [("all", self._title, self._artifacts)] if self._artifacts else []
        self._list.sync([(key, title, [(a["id"], a) for a in items]) for key, title, items in groups])
        self._stack.set_visible_child_name("content" if self._artifacts else "empty")

    def _update(self, row: RecordRow, artifact: Artifact) -> None:
        row.set_icon(file_icon(artifact["fileName"]))
        row.set_content(artifact["fileName"], (artifact.get("note") or "").strip() or None, artifact_meta(artifact))
        label, tone = source_badge(artifact)
        row.set_status(label if tone != "neutral" else None, tone)
        downloading = self.actions.downloading(artifact["id"])
        row.set_progress(self.actions.progress(artifact["id"]), downloading)
        actions = [RowAction("save", "save", ARTIFACTS["save"], lambda: self.actions.save(artifact), not downloading)]
        actions.append(RowAction("open", "external", ARTIFACTS["open"], lambda: self.actions.open_link(artifact)))
        if self.actions.can_send:
            actions.append(RowAction("send", "send", ARTIFACTS["send"], lambda: self.actions.send(artifact)))
        actions.append(RowAction("delete", "delete", ARTIFACTS["delete"], lambda: self.actions.delete(artifact), destructive=True))
        row.set_actions(actions)

    def _progress(self, artifact_id: str, fraction: float) -> None:
        row = self._list.widget(artifact_id)
        if row is not None:
            row.set_progress(fraction, True)
