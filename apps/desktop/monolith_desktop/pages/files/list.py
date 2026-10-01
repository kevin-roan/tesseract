from collections.abc import Callable, Mapping
from typing import TYPE_CHECKING

from gi.repository import Gtk

from ...api.types import Artifact
from ...widgets.keyed_list import KeyedList
from ...widgets.record_row import RecordRow, RowAction
from ...widgets.section import Section
from .actions import ArtifactActions
from .labels import ARTIFACTS
from .model import artifact_detail, artifact_meta, source_badge

if TYPE_CHECKING:
    from ...context import AppContext


class ArtifactList(Gtk.Box):
    def __init__(
        self,
        ctx: "AppContext",
        title: str,
        empty_label: str,
        report: Callable[[str], None],
        on_deleted: Callable[[str], None],
        show_project: bool = False,
    ) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self._show_project = show_project
        self._artifacts: list[Artifact] = []
        self._names: Mapping[str, str] = {}
        self._empty_label = empty_label
        self.actions = ArtifactActions(ctx, report, self._rerender, self._progress, on_deleted)
        self._list = KeyedList(lambda: RecordRow("artifacts"), self._update)
        self._section = Section(title, self._list, empty_label=empty_label)
        self.append(self._section)
        self.connect("map", lambda *_: self.actions.load_taildrop())

    @property
    def artifacts(self) -> list[Artifact]:
        return list(self._artifacts)

    def render(self, artifacts: list[Artifact] | None, names: Mapping[str, str] | None = None, empty_label: str | None = None) -> None:
        if artifacts is None:
            self._section.set_loading(True)
            return
        self._artifacts = artifacts
        self._names = names or {}
        self._empty_label = empty_label or self._empty_label
        self._section.set_loading(False)
        self._rerender()

    def _rerender(self) -> None:
        self._list.sync((artifact["id"], artifact) for artifact in self._artifacts)
        self._section.set_empty(not self._artifacts, self._empty_label)

    def _update(self, row: RecordRow, artifact: Artifact) -> None:
        project = self._names.get(artifact["projectId"], artifact["projectId"]) if self._show_project else None
        row.set_content(artifact["fileName"], artifact_meta(artifact, project=project), artifact_detail(artifact))
        row.set_status(*source_badge(artifact))
        downloading = self.actions.downloading(artifact["id"])
        row.set_progress(self.actions.progress(artifact["id"]), downloading)
        actions = [RowAction("open", "external", ARTIFACTS["open"], lambda: self.actions.open_link(artifact))]
        if self.actions.can_send:
            actions.append(RowAction("send", "send", ARTIFACTS["send"], lambda: self.actions.send(artifact)))
        actions.append(RowAction("delete", "delete", ARTIFACTS["delete"], lambda: self.actions.delete(artifact), destructive=True))
        actions.append(RowAction("save", "save", ARTIFACTS["save"], lambda: self.actions.save(artifact), not downloading, labeled=True))
        row.set_actions(actions)

    def _progress(self, artifact_id: str, fraction: float) -> None:
        row = self._list.widget(artifact_id)
        if row is not None:
            row.set_progress(fraction, True)
