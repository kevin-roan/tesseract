from collections.abc import Callable
from typing import TYPE_CHECKING

from gi.repository import Gtk

from ...api.errors import describe_error
from ...api.types import ProcessInfo, Project
from ...widgets.form_dialog import FormDialog
from .labels import RUN_DIALOG
from .model import ProcessDraft, is_conflict, prefers_display, validate_process_draft

if TYPE_CHECKING:
    from ...context import AppContext

RUN_DIALOG_HEIGHT = 520


class RunCommandDialog:
    def __init__(self, ctx: "AppContext", project: Project, on_started: Callable[[ProcessInfo], None]) -> None:
        self._ctx = ctx
        self._project = project
        self._on_started = on_started
        dialog = FormDialog(
            RUN_DIALOG["title"],
            RUN_DIALOG["subtitle"].format(path=project.get("path", "")),
            RUN_DIALOG["start"],
            self._submit,
            RUN_DIALOG["cancel"],
            height=RUN_DIALOG_HEIGHT,
        )
        self.dialog = dialog
        group = dialog.add_group()
        self._command = dialog.add_entry(group, "command", RUN_DIALOG["command"])
        self._name = dialog.add_entry(group, "name", RUN_DIALOG["name"])
        options = dialog.add_group()
        self._port = dialog.add_entry(options, "port", RUN_DIALOG["port"])
        self._port.set_input_purpose(Gtk.InputPurpose.DIGITS)
        self._display = dialog.add_switch(
            options, RUN_DIALOG["display"], RUN_DIALOG["display_subtitle"], prefers_display(project.get("framework", ""))
        )

    def present(self) -> None:
        self.dialog.present(self._ctx.window)
        self._command.grab_focus()

    def _submit(self) -> None:
        draft = ProcessDraft(self._command.get_text(), self._name.get_text(), self._port.get_text(), self._display.get_active())
        result = validate_process_draft(draft, self._project["id"])
        self.dialog.set_error(None)
        self.dialog.set_field_errors(result.errors)
        if not result.ok:
            return
        self.dialog.set_busy(True)
        self._ctx.call(
            lambda client: client.start_process(result.body),
            self._started,
            lambda error: self._failed(error, result.body.get("port")),
            lambda: self.dialog.set_busy(False),
        )

    def _failed(self, error: BaseException, port: int | None) -> None:
        if is_conflict(error) and port:
            self.dialog.set_field_errors({"port": RUN_DIALOG["conflict"].format(port=port, message=describe_error(error))})
        else:
            self.dialog.set_error(describe_error(error))

    def _started(self, process: ProcessInfo) -> None:
        self.dialog.close()
        self._on_started(process)
