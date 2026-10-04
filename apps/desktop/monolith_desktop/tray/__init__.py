import logging
from typing import TYPE_CHECKING

from ..store import ConnectionState
from ..strings import CONNECTION_LABELS, TRAY

if TYPE_CHECKING:
    from ..app import MonolithApplication

log = logging.getLogger(__name__)


def tooltip(state: ConnectionState) -> str:
    return TRAY["tooltip"].format(status=CONNECTION_LABELS.get(state.status, state.status))


def attach(app: "MonolithApplication") -> bool:
    """Puts the icon in the panel's tray (StatusNotifierWatcher), now or whenever one starts; True when one runs now."""
    from .sni import MenuEntry, StatusNotifierItem, watcher_available

    connection = app.get_dbus_connection()
    if connection is None:
        return False
    entries = [
        MenuEntry(TRAY["open"], app.show_window),
        MenuEntry(TRAY["hide"], app.hide_window),
        MenuEntry(TRAY["refresh"], lambda: app.activate_action("refresh", None)),
        MenuEntry(TRAY["pair"], lambda: app.activate_action("pair", None)),
        MenuEntry(TRAY["pair_host"], lambda: app.activate_action("pair-host", None)),
        MenuEntry(TRAY["preferences"], lambda: app.activate_action("preferences", None)),
        MenuEntry(None),
        MenuEntry(TRAY["quit"], app.quit_app),
    ]
    item = StatusNotifierItem(connection, entries, app.toggle_window, app.tray_host_changed)
    item.start()
    if app.ctx is not None:
        app.ctx.store.connection.subscribe(lambda state: item.set_tooltip(tooltip(state)))
    app.tray_item = item
    available = watcher_available(connection)
    if not available:
        log.info("no system tray (StatusNotifierWatcher) yet; the icon appears when one starts")
    return available


def detach(app: "MonolithApplication") -> None:
    item = getattr(app, "tray_item", None)
    if item is not None:
        item.stop()
        app.tray_item = None
