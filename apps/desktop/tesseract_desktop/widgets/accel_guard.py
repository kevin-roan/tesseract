from typing import Any

from gi.repository import Gdk, Gtk

RESERVED = Gdk.ModifierType.SUPER_MASK
KEPT = Gdk.ModifierType.CONTROL_MASK | Gdk.ModifierType.SHIFT_MASK


def conflicts(accel: str) -> bool:
    ok, _key, mods = Gtk.accelerator_parse(accel)
    if not ok:
        return False
    return not (mods & RESERVED) and (mods & KEPT) != KEPT


class AccelGuard:
    def __init__(self) -> None:
        self._app: Any = None
        self._holders = 0
        self._saved: dict[str, list[str]] = {}

    def acquire(self, app: Any) -> bool:
        if app is None:
            return False
        if self._holders == 0:
            self._app = app
            for action in app.list_action_descriptions():
                accels = list(app.get_accels_for_action(action))
                kept = [accel for accel in accels if not conflicts(accel)]
                if kept != accels:
                    self._saved[action] = accels
                    app.set_accels_for_action(action, kept)
        self._holders += 1
        return True

    def release(self) -> None:
        if self._holders == 0:
            return
        self._holders -= 1
        if self._holders == 0 and self._app is not None:
            for action, accels in self._saved.items():
                self._app.set_accels_for_action(action, accels)
            self._saved = {}
            self._app = None


GUARD = AccelGuard()
