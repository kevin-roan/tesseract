from typing import TYPE_CHECKING

from gi.repository import Gtk

from ...api.types import Artifact
from ..files.list import ArtifactList
from .labels import ARTIFACTS

if TYPE_CHECKING:
    from .detail import ProjectDetail


class ArtifactsTab:
    def __init__(self, host: "ProjectDetail") -> None:
        self.widget = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self._list = ArtifactList(
            host.ctx, ARTIFACTS["list"], ARTIFACTS["list_empty"], host.report, lambda artifact_id: host.remove("artifacts", artifact_id),
            empty_title=ARTIFACTS["empty_title"],
        )
        self.widget.append(self._list)

    def render(self, artifacts: list[Artifact] | None) -> None:
        self._list.render(artifacts)
