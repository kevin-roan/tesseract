from typing import TYPE_CHECKING

from ...api.errors import describe_error
from ...api.types import Project
from ...services.workspace import upsert
from ...widgets.form_dialog import FormDialog
from .labels import PROJECTS_ROOT, RENAME
from .model import rename_error, rename_value

if TYPE_CHECKING:
    from ...context import AppContext

DIALOG_WIDTH = 460


class RenameProjectDialog:
    def __init__(self, ctx: "AppContext", project: Project) -> None:
        self._ctx = ctx
        self._project_id = project["id"]
        self._current = project.get("name") or project["id"]
        dialog = FormDialog(
            RENAME["title"], RENAME["subtitle"].format(root=PROJECTS_ROOT, id=self._project_id), RENAME["save"], self._submit,
            RENAME["cancel"], DIALOG_WIDTH, context=self._current, icon="project",
        )
        self.dialog = dialog
        group = dialog.add_group(description=RENAME["hint"])
        self._name = dialog.add_title(group, "name", RENAME["name"], self._current)

    def present(self) -> None:
        self.dialog.present(self._ctx.window)
        self._name.grab_focus()

    def _submit(self) -> None:
        text = self._name.get_text()
        error = rename_error(text)
        self.dialog.set_error(None)
        self.dialog.set_field_errors({"name": error} if error else {})
        if error:
            return
        name = rename_value(text)
        if name == self._current:
            self.dialog.close()
            return
        self.dialog.set_busy(True)
        self._ctx.call(
            lambda client: client.rename_project(self._project_id, name),
            lambda project: self._renamed(project, name),
            lambda error: self.dialog.set_error(describe_error(error)),
            lambda: self.dialog.set_busy(False),
        )

    def _renamed(self, project: Project, name: str | None) -> None:
        store = self._ctx.store.projects
        if store.value is not None:
            store.set(upsert(store.value, project))
        self._ctx.toast(RENAME["renamed"].format(name=project["name"]) if name else RENAME["reset"].format(id=project["id"]))
        self.dialog.close()
