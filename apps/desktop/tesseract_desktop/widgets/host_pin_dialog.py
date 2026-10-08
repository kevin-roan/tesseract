from gi.repository import Adw

from ..context import AppContext
from ..hostshell.model import pin_error
from ..strings import HOST_PIN as S
from .form_dialog import FormDialog

DIALOG_WIDTH = 400


class HostPinDialog(FormDialog):
    """Sets the host shell PIN through `host pin --stdin`; the PIN never touches argv or disk in clear."""

    def __init__(self, ctx: AppContext, toast_target: Adw.Dialog | None = None) -> None:
        super().__init__(S["title"], S["subtitle"], S["save"], self._save, S["cancel"], DIALOG_WIDTH, context=S["context"], icon="host")
        self._ctx = ctx
        self._toast_target = toast_target
        group = self.add_group(description=S["description"])
        self._pin = self.add_entry(group, "pin", S["pin"], password=True)
        self._repeat = self.add_entry(group, "repeat", S["repeat"], password=True)

    def _save(self) -> None:
        pin, repeat = self._pin.get_text(), self._repeat.get_text()
        problem = pin_error(pin, repeat)
        if problem == "pin":
            self.set_field_errors({"pin": S["invalid"]})
            return
        if problem == "repeat":
            self.set_field_errors({"repeat": S["mismatch"]})
            return
        self.set_error(None)
        self.set_busy(True)
        self._ctx.host_shell.set_pin(pin, self._saved, self._failed)

    def _saved(self) -> None:
        self.set_busy(False)
        if self._toast_target is not None:
            self._toast_target.add_toast(Adw.Toast(title=S["saved"]))
        else:
            self._ctx.toast(S["saved"])
        self.close()

    def _failed(self, error: BaseException) -> None:
        self.set_busy(False)
        self.set_error(S["failed"].format(error=error))
