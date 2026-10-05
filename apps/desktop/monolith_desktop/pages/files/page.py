from collections.abc import Callable
from typing import Any

from gi.repository import Gtk

from ...api.errors import describe_error
from ...api.types import Artifact, BuildOutput
from ...widgets.buttons import IconButton
from ...widgets.choice_dropdown import ChoiceDropdown
from ...widgets.feedback import EmptyState, Notice
from ...widgets.lifecycle import while_mapped
from ...widgets.list_view import ListToolbar, PillTabs
from ...widgets.motion import crossfade_stack
from ..base import Page
from .labels import FILES, OUTPUTS, TITLE
from .list import ArtifactList
from .model import (
    ALL,
    BUILDS,
    SHARED,
    filter_artifacts,
    filter_outputs,
    newest_artifacts,
    project_names,
    project_options,
    remove_artifact,
    source_options,
    upsert_artifact,
    view_options,
)
from .outputs import BuildOutputList

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
        self._outputs: list[BuildOutput] | None = None
        self._view = SHARED
        self._output_project = ALL
        self._project = ALL
        self._source = ALL
        self._stack = crossfade_stack()
        self._state = EmptyState(FILES["loading"], loading=True)
        self._stack.add_named(self._state, STATE)

        content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self._tabs = PillTabs(view_options(), SHARED, self._set_view, FILES["view"])
        toolbar = ListToolbar(self._tabs)
        self._project_filter = ChoiceDropdown(project_options(None, {}), ALL, self._set_project, FILES["project_filter"])
        self._source_filter = ChoiceDropdown(source_options(), ALL, self._set_source, FILES["source_filter"])
        self._output_filter = ChoiceDropdown(project_options(None, {}), ALL, self._set_output_project, FILES["project_filter"])
        self._output_filter.set_visible(False)
        for dropdown in (self._project_filter, self._source_filter, self._output_filter):
            toolbar.end.append(dropdown)
        content.append(toolbar)

        self._notice = Notice("", tone="danger")
        self._notice.set_visible(False)
        self._notice.add_css_class("to-list-notice")
        self._notice.set_action(FILES["dismiss"], lambda: self._notice.set_visible(False))
        content.append(self._notice)

        self._list = ArtifactList(
            self.ctx, FILES["list"], FILES["empty"], self.report, self._removed, show_project=True, empty_title=FILES["empty_title"]
        )
        self._output_list = BuildOutputList(self.ctx, self.report)
        self._views = crossfade_stack(vhomogeneous=False)
        self._views.add_named(self._list, SHARED)
        self._views.add_named(self._output_list, BUILDS)
        body = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, css_classes=["to-list-body"])
        body.append(self._views)
        content.append(Gtk.ScrolledWindow(child=body, hscrollbar_policy=Gtk.PolicyType.NEVER, vexpand=True))
        self._stack.add_named(content, CONTENT)

        self._poller = self.ctx.poll(lambda client: client.list_artifacts(), REFRESH_INTERVAL_S, self._loaded, self._failed)
        self._poller.bind(self._stack)
        self._output_poller = self.ctx.poll(
            lambda client: client.list_build_outputs(), REFRESH_INTERVAL_S, self._outputs_loaded, self._outputs_failed
        )
        self._output_poller.bind(self._output_list)
        while_mapped(self._stack, self._attach)
        return self._stack

    def header_widgets(self) -> list[Gtk.Widget]:
        return [IconButton("refresh", FILES["refresh"], self.refresh)]

    def open(self, params: dict[str, Any]) -> None:
        if params.get("view") in (SHARED, BUILDS):
            self._tabs.select(params["view"])
        artifact_id = params.get("artifactId")
        if isinstance(artifact_id, str) and artifact_id:
            self._list.actions.save_by_id(artifact_id, params.get("projectId"), self._artifacts)

    def refresh(self) -> None:
        if self._artifacts is None:
            self._state.set_content(FILES["loading"], loading=True)
        self._poller.refresh()
        if self._view == BUILDS:
            self._output_poller.refresh()

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

    def _outputs_failed(self, error: BaseException) -> None:
        if self._outputs is None:
            self._output_list.render([], {}, (OUTPUTS["error_title"], describe_error(error)))
        else:
            self.report(describe_error(error))

    def _outputs_loaded(self, outputs: list[BuildOutput]) -> None:
        self._outputs = outputs
        self._render()

    def _set_view(self, view: str) -> None:
        self._view = view
        self._views.set_visible_child_name(view)
        for dropdown in (self._project_filter, self._source_filter):
            dropdown.set_visible(view == SHARED)
        self._output_filter.set_visible(view == BUILDS)
        self._render()

    def _set_output_project(self, project_id: str) -> None:
        self._output_project = project_id
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
        visible = filter_artifacts(self._artifacts, self._project, self._source)
        self._tabs.set_count(SHARED, len(self._artifacts))
        self._list.render(visible, names, None if not self._artifacts or visible else (FILES["no_match"], None))
        self._render_outputs(names)

    def _render_outputs(self, names: dict[str, str]) -> None:
        if self._outputs is None:
            return
        self._tabs.set_count(BUILDS, len(self._outputs))
        self._output_filter.set_options(project_options(self._outputs, names), self._output_project)
        self._output_project = self._output_filter.selected_id or ALL
        visible = filter_outputs(self._outputs, self._output_project)
        empty = (OUTPUTS["no_match"], None) if self._outputs else (OUTPUTS["empty_title"], OUTPUTS["empty"])
        self._output_list.render(visible, names, empty)
