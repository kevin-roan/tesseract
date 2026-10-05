from collections.abc import Callable
from typing import TYPE_CHECKING

from ...api.errors import describe_error
from ...api.types import Project, SyncChanges
from ...services.workspace import remove_ids
from ...widgets.confirm_dialog import confirm
from .labels import REMOVE
from .model import removal_prompt

if TYPE_CHECKING:
    from ...context import AppContext


def remove_project(ctx: "AppContext", project: Project, on_removed: Callable[[], None] | None = None) -> None:
    """Checks for changes not synced back to the host, confirms, then deletes (forced only after the user saw them)."""
    project_id = project["id"]
    name = project.get("name") or project_id

    def failed(error: BaseException) -> None:
        ctx.toast(REMOVE["failed"].format(name=name, error=describe_error(error)))

    def deleted(_result: object) -> None:
        store = ctx.store.projects
        if store.value is not None:
            store.set(remove_ids(store.value, [project_id]))
        ctx.toast(REMOVE["deleted"].format(name=name))
        if on_removed:
            on_removed()

    def checked(sync: SyncChanges) -> None:
        prompt = removal_prompt(name, sync)
        confirm(
            ctx.window, prompt.heading, prompt.body, prompt.confirm_label, REMOVE["cancel"],
            lambda: ctx.call(lambda client: client.delete_project(project_id, prompt.force), deleted, failed),
        )

    ctx.call(lambda client: client.sync_changes(project_id), checked, failed)
