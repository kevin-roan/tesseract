from collections.abc import Callable
from typing import Any

from gi.repository import Gtk

from ...api.errors import describe_error
from ...api.types import Artifact
from ...widgets.choice_dropdown import ChoiceDropdown
from ...widgets.feedback import EmptyState, Notice
from ...widgets.header import HeaderAction, ScreenHeader
from ...widgets.lifecycle import while_mapped
from ...widgets.page_body import PageBody
from ..base import Page
from .labels import FILES, TITLE
from .list import ArtifactList
from .model import (
    ALL,
    files_subtitle,
    filter_artifacts,
    newest_artifacts,
    project_names,
    project_options,
    remove_artifact,
    source_options,
    upsert_artifact,
)

REFRESH_INTERVAL_S = 30.0
STATE, CONTENT = "state", "content"


class FilesPage(Page):
    id = "files"
    title = TITLE
    icon = "files"
    section = "sandbox"
    order = 25

    def build(self) -> Gtk.Widget:
        self._artifacts: list[Artifact] | None = None
        self._project = ALL
        self._source = ALL
        self._stack = Gtk.Stack(transition_type=Gtk.StackTransitionType.CROSSFADE)
        self._state = EmptyState(FILES["loading"], loading=True)
        self._stack.add_named(self._state, STATE)

        body = PageBody(spacing=24)
        self._header = ScreenHeader(TITLE, actions=[HeaderAction("refresh", "refresh", FILES["refresh"], self.refresh)])
        body.append(self._header)

        filters = Gtk.Box(spacing=8)
        self._project_filter = ChoiceDropdown(project_options(None, {}), ALL, self._set_project, FILES["project_filter"])
        self._source_filter = ChoiceDropdown(source_options(), ALL, self._set_source, FILES["source_filter"])
        filters.append(self._project_filter)
        filters.append(self._source_filter)
        body.append(filters)

        self._notice = Notice("", tone="danger")
        self._notice.set_visible(False)
        self._notice.set_action(FILES["dismiss"], lambda: self._notice.set_visible(False))
        body.append(self._notice)

        self._list = ArtifactList(self.ctx, FILES["list"], FILES["empty"], self.report, self._removed, show_project=True)
        body.append(self._list)
        self._stack.add_named(body, CONTENT)

        self._poller = self.ctx.poll(lambda client: client.list_artifacts(), REFRESH_INTERVAL_S, self._loaded, self._failed)
        self._poller.bind(self._stack)
        while_mapped(self._stack, self._attach)
        return self._stack

    def open(self, params: dict[str, Any]) -> None:
        artifact_id = params.get("artifactId")
        if isinstance(artifact_id, str) and artifact_id:
            self._list.actions.save_by_id(artifact_id, params.get("projectId"), self._artifacts)

    def refresh(self) -> None:
        if self._artifacts is None:
            self._state.set_content(FILES["loading"], loading=True)
        self._poller.refresh()

    def report(self, message: str) -> None:
        self._notice.update(message, tone="danger")
        self._notice.set_visible(True)

    def _attach(self) -> Callable[[], None]:
        detach = [
            self.ctx.subscribe("artifact.created", lambda message: self._created(message.get("artifact"))),
            self.ctx.subscribe("artifact.deleted", lambda message: self._removed(message.get("id"))),
            self.ctx.store.projects.subscribe(lambda _projects: self._render(), immediate=False),
        ]
        return lambda: [unsubscribe() for unsubscribe in detach]

    def _loaded(self, artifacts: list[Artifact]) -> None:
        self._artifacts = newest_artifacts(artifacts)
        self._render()

    def _failed(self, error: BaseException) -> None:
        if self._artifacts is not None:
            self.report(describe_error(error))
            return
        self._state.set_content(FILES["error_title"], describe_error(error), "warning", False, FILES["retry"], self.refresh)
        self._stack.set_visible_child_name(STATE)

    def _created(self, artifact: Any) -> None:
        if isinstance(artifact, dict) and artifact.get("id") and self._artifacts is not None:
            self._artifacts = upsert_artifact(self._artifacts, artifact)
            self._render()

    def _removed(self, artifact_id: Any) -> None:
        if isinstance(artifact_id, str) and self._artifacts is not None:
            self._artifacts = remove_artifact(self._artifacts, artifact_id)
            self._render()

    def _set_project(self, project_id: str) -> None:
        self._project = project_id
        self._render()

    def _set_source(self, source: str) -> None:
        self._source = source
        self._render()

    def _render(self) -> None:
        if self._artifacts is None:
            return
        self._stack.set_visible_child_name(CONTENT)
        names = project_names(self.ctx.store.projects.value)
        self._project_filter.set_options(project_options(self._artifacts, names), self._project)
        self._project = self._project_filter.selected_id or ALL
        self._header.set_subtitle(files_subtitle(self._artifacts))
        visible = filter_artifacts(self._artifacts, self._project, self._source)
        empty = FILES["no_match"] if self._artifacts else FILES["empty"]
        self._list.render(visible, names, empty)
