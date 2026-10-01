from collections.abc import Callable
from typing import TYPE_CHECKING

from gi.repository import Gtk

from ...api.errors import describe_error
from ...api.types import CreateProjectResponse
from ...services.workspace import upsert
from ...widgets.badges import StatusBadge
from ...widgets.form_dialog import FormDialog
from ...widgets.log_panel import LogPanel
from ...widgets.text import Text
from .labels import CREATE, LOGS, PROJECTS_ROOT
from .model import ProjectDraft, clone_outcome, create_label, is_conflict, location_hint, validate_project_draft
from .streams import LogFollower

if TYPE_CHECKING:
    from ...context import AppContext

PROGRESS_PAGE = "progress"
CLONE_LOG_HEIGHT = 260


class CreateProjectDialog:
    def __init__(self, ctx: "AppContext", on_open: Callable[[str], None]) -> None:
        self._ctx = ctx
        self._on_open = on_open
        self._project_id: str | None = None
        self._cloning = False
        dialog = FormDialog(CREATE["title"], CREATE["subtitle"], CREATE["create"], self._submit, CREATE["cancel"])
        self.dialog = dialog
        self._details = dialog.add_group(CREATE["details"], location_hint(""))
        self._name = dialog.add_entry(self._details, "name", CREATE["name"])
        self._name.connect("changed", lambda row: self._details.set_description(location_hint(row.get_text())))
        source = dialog.add_group(CREATE["source"], CREATE["source_hint"])
        self._git_url = dialog.add_entry(source, "git_url", CREATE["git_url"])
        self._branch = dialog.add_entry(source, "branch", CREATE["branch"])
        self._git_url.connect("changed", lambda row: dialog.set_primary(create_label(row.get_text()), self._submit))
        dialog.add_page(PROGRESS_PAGE, self._build_progress())
        dialog.connect("closed", lambda *_: self._closed())

    def _build_progress(self) -> Gtk.Widget:
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12, css_classes=["to-form-body"])
        header = Gtk.Box(spacing=8)
        self._progress_title = Text("", "h4")
        self._progress_title.set_hexpand(True)
        self._badge = StatusBadge(CREATE["cloning"], "info")
        header.append(self._progress_title)
        header.append(self._badge)
        box.append(header)
        self._panel = LogPanel(LOGS["close"], None, LOGS["empty"], LOGS["jump"], CLONE_LOG_HEIGHT)
        self._panel.set_vexpand(True)
        box.append(self._panel)
        self._message = Text("", "bodySmall", "textSecondary", wrap=True, lines=None)
        self._message.set_visible(False)
        box.append(self._message)
        self._follower = LogFollower(self._ctx, self._panel, on_exit=self._clone_finished).bind(self._panel)
        return box

    def present(self) -> None:
        self.dialog.present(self._ctx.window)
        self._name.grab_focus()

    def _existing_ids(self) -> list[str]:
        return [project["id"] for project in self._ctx.store.projects.value or []]

    def _submit(self) -> None:
        draft = ProjectDraft(self._name.get_text(), self._git_url.get_text(), self._branch.get_text())
        result = validate_project_draft(draft, self._existing_ids())
        self.dialog.set_error(None)
        self.dialog.set_field_errors(result.errors)
        if not result.ok:
            return
        self.dialog.set_busy(True)
        self._ctx.call(
            lambda client: client.create_project(result.name, result.git_url, result.branch),
            self._created,
            lambda error: self._failed(error, result.project_id),
            lambda: self.dialog.set_busy(False),
        )

    def _failed(self, error: BaseException, project_id: str | None) -> None:
        if is_conflict(error):
            self.dialog.set_field_errors({"name": CREATE["conflict"].format(root=PROJECTS_ROOT, id=project_id)})
        else:
            self.dialog.set_error(describe_error(error))

    def _created(self, response: CreateProjectResponse) -> None:
        project = response["project"]
        self._project_id = project["id"]
        store = self._ctx.store.projects
        if store.value is not None:
            store.set(upsert(store.value, project))
        self._ctx.workspace.refresh_projects()
        process_id = response.get("processId")
        if not process_id:
            self._ctx.toast(CREATE["created"].format(name=project["name"]))
            self.dialog.close()
            self._on_open(project["id"])
            return
        self._cloning = True
        self._progress_title.set_label(CREATE["cloning_title"].format(name=project["name"]))
        self._panel.set_title(" ".join(filter(None, [self._git_url.get_text().strip(), self._branch.get_text().strip()])))
        self.dialog.set_primary(None)
        self.dialog.set_secondary(CREATE["close"], self.dialog.close)
        self.dialog.show_page(PROGRESS_PAGE)
        self._follower.follow("process", process_id)

    def _clone_finished(self, code: int | None) -> None:
        self._cloning = False
        outcome = clone_outcome(code, True)
        self._badge.update(outcome.label, outcome.tone)
        self._message.set_text_value(outcome.message)
        self._ctx.workspace.refresh_projects()
        self.dialog.set_primary(CREATE["open"] if outcome.ok else CREATE["open_anyway"], self._open)

    def _open(self) -> None:
        project_id = self._project_id
        self.dialog.close()
        if project_id:
            self._on_open(project_id)

    def _closed(self) -> None:
        self._follower.stop()
        if self._cloning:
            self._ctx.toast(CREATE["background"])
