from collections.abc import Callable

from ..context import AppContext
from ..hostshell.model import PIN_PATTERN
from ..strings import HOST_UNLOCK as S
from .form_dialog import FormDialog

DIALOG_WIDTH = 400


class HostUnlockDialog(FormDialog):
    """Trades the host shell PIN for a session the app keeps in memory, then calls `on_unlocked`."""

    def __init__(self, ctx: AppContext, on_unlocked: Callable[[], None]) -> None:
        super().__init__(S["title"], S["subtitle"], S["unlock"], self._unlock, S["cancel"], DIALOG_WIDTH, context=S["context"], icon="host")
        self._ctx = ctx
        self._on_unlocked = on_unlocked
        group = self.add_group()
        self._pin = self.add_entry(group, "pin", S["pin"], password=True)

    def _unlock(self) -> None:
        pin = self._pin.get_text()
        if not PIN_PATTERN.fullmatch(pin):
            self.set_field_errors({"pin": S["invalid"]})
            return
        self.set_error(None)
        self.set_busy(True)
        self._ctx.host_shell.unlock(pin, self._unlocked, self._failed)

    def _unlocked(self) -> None:
        self.set_busy(False)
        self.close()
        self._on_unlocked()

    def _failed(self, error: BaseException) -> None:
        self.set_busy(False)
        self.set_error(str(error))
