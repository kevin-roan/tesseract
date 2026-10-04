"""Tray icon over D-Bus: a StatusNotifierItem with a com.canonical.dbusmenu menu.

Shown by any StatusNotifierWatcher host (KDE, waybar, Quickshell, AGS, GNOME with the AppIndicator extension).
"""

import logging
import os
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import gi

gi.require_version("GdkPixbuf", "2.0")
from gi.repository import GdkPixbuf, Gio, GLib  # noqa: E402

from .. import APP_ID, APP_NAME  # noqa: E402
from ..paths import ICONS_DIR  # noqa: E402

log = logging.getLogger(__name__)

WATCHER_NAME = "org.kde.StatusNotifierWatcher"
WATCHER_PATH = "/StatusNotifierWatcher"
ITEM_PATH = "/StatusNotifierItem"
MENU_PATH = "/MenuBar"
ICON_FILE = ICONS_DIR / "hicolor" / "256x256" / "apps" / f"{APP_ID}.png"
PIXMAP_SIZES = (22, 32, 48)

ITEM_XML = """
<node>
  <interface name="org.kde.StatusNotifierItem">
    <property name="Category" type="s" access="read"/>
    <property name="Id" type="s" access="read"/>
    <property name="Title" type="s" access="read"/>
    <property name="Status" type="s" access="read"/>
    <property name="WindowId" type="i" access="read"/>
    <property name="IconName" type="s" access="read"/>
    <property name="IconThemePath" type="s" access="read"/>
    <property name="IconPixmap" type="a(iiay)" access="read"/>
    <property name="ToolTip" type="(sa(iiay)ss)" access="read"/>
    <property name="ItemIsMenu" type="b" access="read"/>
    <property name="Menu" type="o" access="read"/>
    <method name="Activate"><arg name="x" type="i" direction="in"/><arg name="y" type="i" direction="in"/></method>
    <method name="SecondaryActivate"><arg name="x" type="i" direction="in"/><arg name="y" type="i" direction="in"/></method>
    <method name="ContextMenu"><arg name="x" type="i" direction="in"/><arg name="y" type="i" direction="in"/></method>
    <method name="Scroll"><arg name="delta" type="i" direction="in"/><arg name="orientation" type="s" direction="in"/></method>
    <signal name="NewTitle"/>
    <signal name="NewIcon"/>
    <signal name="NewToolTip"/>
    <signal name="NewStatus"><arg name="status" type="s"/></signal>
  </interface>
</node>
"""

MENU_XML = """
<node>
  <interface name="com.canonical.dbusmenu">
    <property name="Version" type="u" access="read"/>
    <property name="TextDirection" type="s" access="read"/>
    <property name="Status" type="s" access="read"/>
    <property name="IconThemePath" type="as" access="read"/>
    <method name="GetLayout">
      <arg name="parentId" type="i" direction="in"/>
      <arg name="recursionDepth" type="i" direction="in"/>
      <arg name="propertyNames" type="as" direction="in"/>
      <arg name="revision" type="u" direction="out"/>
      <arg name="layout" type="(ia{sv}av)" direction="out"/>
    </method>
    <method name="GetGroupProperties">
      <arg name="ids" type="ai" direction="in"/>
      <arg name="propertyNames" type="as" direction="in"/>
      <arg name="properties" type="a(ia{sv})" direction="out"/>
    </method>
    <method name="GetProperty">
      <arg name="id" type="i" direction="in"/>
      <arg name="name" type="s" direction="in"/>
      <arg name="value" type="v" direction="out"/>
    </method>
    <method name="Event">
      <arg name="id" type="i" direction="in"/>
      <arg name="eventId" type="s" direction="in"/>
      <arg name="data" type="v" direction="in"/>
      <arg name="timestamp" type="u" direction="in"/>
    </method>
    <method name="EventGroup">
      <arg name="events" type="a(isvu)" direction="in"/>
      <arg name="idErrors" type="ai" direction="out"/>
    </method>
    <method name="AboutToShow">
      <arg name="id" type="i" direction="in"/>
      <arg name="needUpdate" type="b" direction="out"/>
    </method>
    <method name="AboutToShowGroup">
      <arg name="ids" type="ai" direction="in"/>
      <arg name="updatesNeeded" type="ai" direction="out"/>
      <arg name="idErrors" type="ai" direction="out"/>
    </method>
    <signal name="ItemsPropertiesUpdated">
      <arg name="updatedProps" type="a(ia{sv})"/>
      <arg name="removedProps" type="a(ias)"/>
    </signal>
    <signal name="LayoutUpdated"><arg name="revision" type="u"/><arg name="parent" type="i"/></signal>
    <signal name="ItemActivationRequested"><arg name="id" type="i"/><arg name="timestamp" type="u"/></signal>
  </interface>
</node>
"""


@dataclass(frozen=True)
class MenuEntry:
    label: str | None
    action: Callable[[], None] | None = None

    @property
    def separator(self) -> bool:
        return self.label is None


def entry_properties(entry: MenuEntry) -> dict[str, GLib.Variant]:
    if entry.separator:
        return {"type": GLib.Variant("s", "separator")}
    return {"label": GLib.Variant("s", entry.label), "enabled": GLib.Variant("b", True), "visible": GLib.Variant("b", True)}


def menu_layout(entries: list[MenuEntry], revision: int) -> GLib.Variant:
    children = [GLib.Variant("v", GLib.Variant("(ia{sv}av)", (index, entry_properties(entry), []))) for index, entry in enumerate(entries, 1)]
    root = (0, {"children-display": GLib.Variant("s", "submenu")}, children)
    return GLib.Variant("(u(ia{sv}av))", (revision, root))


def argb_pixmaps(path: str = str(ICON_FILE), sizes: tuple[int, ...] = PIXMAP_SIZES) -> list[tuple[int, int, bytes]]:
    """The icon rendered as SNI pixmaps: ARGB32 in network byte order."""
    pixmaps = []
    for size in sizes:
        try:
            pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(path, size, size)
        except GLib.Error as error:
            log.debug("tray icon %s not rendered: %s", path, error.message)
            return pixmaps
        if not pixbuf.get_has_alpha():
            pixbuf = pixbuf.add_alpha(False, 0, 0, 0)
        width, height, stride = pixbuf.get_width(), pixbuf.get_height(), pixbuf.get_rowstride()
        pixels = pixbuf.get_pixels()
        data = bytearray()
        for y in range(height):
            row = pixels[y * stride : y * stride + width * 4]
            for x in range(0, width * 4, 4):
                r, g, b, a = row[x : x + 4]
                data += bytes((a, r, g, b))
        pixmaps.append((width, height, bytes(data)))
    return pixmaps


def register_object(connection: Gio.DBusConnection, path: str, interface: Gio.DBusInterfaceInfo, method: Callable, getter: Callable) -> int:
    register = getattr(connection, "register_object_with_closures2", None)
    if register is not None:
        return register(path, interface, method, getter, None)
    return connection.register_object(path, interface, method, getter, None)


class StatusNotifierItem:
    def __init__(
        self,
        connection: Gio.DBusConnection,
        entries: list[MenuEntry],
        on_activate: Callable[[], None],
        on_host: Callable[[bool], None] | None = None,
    ) -> None:
        self.connection = connection
        self.entries = entries
        self.on_activate = on_activate
        self.on_host = on_host
        self.tooltip = APP_NAME
        self.bus_name = f"org.kde.StatusNotifierItem-{os.getpid()}-1"
        self._pixmaps = argb_pixmaps()
        self._revision = 1
        self._registrations: list[int] = []
        self._owner_id = 0
        self._watch_id = 0

    def start(self) -> None:
        item = Gio.DBusNodeInfo.new_for_xml(ITEM_XML).interfaces[0]
        menu = Gio.DBusNodeInfo.new_for_xml(MENU_XML).interfaces[0]
        self._registrations = [
            register_object(self.connection, ITEM_PATH, item, self._item_call, self._item_property),
            register_object(self.connection, MENU_PATH, menu, self._menu_call, self._menu_property),
        ]
        self._owner_id = Gio.bus_own_name_on_connection(self.connection, self.bus_name, Gio.BusNameOwnerFlags.NONE, None, None)
        self._watch_id = Gio.bus_watch_name_on_connection(
            self.connection, WATCHER_NAME, Gio.BusNameWatcherFlags.NONE, lambda *_: self._appeared(), lambda *_: self._vanished()
        )

    def stop(self) -> None:
        if self._watch_id:
            Gio.bus_unwatch_name(self._watch_id)
        if self._owner_id:
            Gio.bus_unown_name(self._owner_id)
        for registration in self._registrations:
            self.connection.unregister_object(registration)
        self._watch_id = self._owner_id = 0
        self._registrations = []

    def set_tooltip(self, text: str) -> None:
        if text == self.tooltip:
            return
        self.tooltip = text
        self._emit(ITEM_PATH, "org.kde.StatusNotifierItem", "NewToolTip", None)

    def _appeared(self) -> None:
        self._register()
        if self.on_host:
            self.on_host(True)

    def _vanished(self) -> None:
        if self.on_host:
            self.on_host(False)

    def _register(self) -> None:
        self.connection.call(
            WATCHER_NAME,
            WATCHER_PATH,
            WATCHER_NAME,
            "RegisterStatusNotifierItem",
            GLib.Variant("(s)", (self.bus_name,)),
            None,
            Gio.DBusCallFlags.NONE,
            -1,
            None,
            self._registered,
        )

    def _registered(self, connection: Gio.DBusConnection, result: Gio.AsyncResult) -> None:
        try:
            connection.call_finish(result)
        except GLib.Error as error:
            log.warning("tray: the StatusNotifierWatcher refused the icon: %s", error.message)

    def _emit(self, path: str, interface: str, signal: str, params: GLib.Variant | None) -> None:
        try:
            self.connection.emit_signal(None, path, interface, signal, params)
        except GLib.Error as error:
            log.debug("tray: %s not sent: %s", signal, error.message)

    def _item_property(self, _connection: Any, _sender: str, _path: str, _interface: str, name: str) -> GLib.Variant | None:
        values: dict[str, GLib.Variant] = {
            "Category": GLib.Variant("s", "ApplicationStatus"),
            "Id": GLib.Variant("s", APP_ID),
            "Title": GLib.Variant("s", APP_NAME),
            "Status": GLib.Variant("s", "Active"),
            "WindowId": GLib.Variant("i", 0),
            "IconName": GLib.Variant("s", APP_ID),
            "IconThemePath": GLib.Variant("s", str(ICONS_DIR)),
            "IconPixmap": GLib.Variant("a(iiay)", self._pixmaps),
            "ToolTip": GLib.Variant("(sa(iiay)ss)", (APP_ID, self._pixmaps, APP_NAME, self.tooltip)),
            "ItemIsMenu": GLib.Variant("b", False),
            "Menu": GLib.Variant("o", MENU_PATH),
        }
        return values.get(name)

    def _item_call(self, _connection: Any, _sender: str, _path: str, _interface: str, method: str, _params: GLib.Variant, invocation: Gio.DBusMethodInvocation) -> None:
        if method in ("Activate", "SecondaryActivate"):
            GLib.idle_add(self._run, self.on_activate)
        invocation.return_value(None)

    def _menu_property(self, _connection: Any, _sender: str, _path: str, _interface: str, name: str) -> GLib.Variant | None:
        values: dict[str, GLib.Variant] = {
            "Version": GLib.Variant("u", 3),
            "TextDirection": GLib.Variant("s", "ltr"),
            "Status": GLib.Variant("s", "normal"),
            "IconThemePath": GLib.Variant("as", [str(ICONS_DIR)]),
        }
        return values.get(name)

    def _menu_call(self, _connection: Any, _sender: str, _path: str, _interface: str, method: str, params: GLib.Variant, invocation: Gio.DBusMethodInvocation) -> None:
        args = params.unpack()
        if method == "GetLayout":
            invocation.return_value(menu_layout(self.entries, self._revision))
        elif method == "GetGroupProperties":
            ids = args[0] or list(range(1, len(self.entries) + 1))
            found = [(i, entry_properties(self.entries[i - 1])) for i in ids if 0 < i <= len(self.entries)]
            invocation.return_value(GLib.Variant("(a(ia{sv}))", (found,)))
        elif method == "GetProperty":
            props = entry_properties(self.entries[args[0] - 1]) if 0 < args[0] <= len(self.entries) else {}
            invocation.return_value(GLib.Variant("(v)", (props.get(args[1], GLib.Variant("s", "")),)))
        elif method == "Event":
            self._event(args[0], args[1])
            invocation.return_value(None)
        elif method == "EventGroup":
            for item_id, event_id, _data, _timestamp in args[0]:
                self._event(item_id, event_id)
            invocation.return_value(GLib.Variant("(ai)", ([],)))
        elif method == "AboutToShow":
            invocation.return_value(GLib.Variant("(b)", (False,)))
        elif method == "AboutToShowGroup":
            invocation.return_value(GLib.Variant("(aiai)", ([], [])))
        else:
            invocation.return_dbus_error("org.freedesktop.DBus.Error.UnknownMethod", method)

    def _event(self, item_id: int, event_id: str) -> None:
        if event_id != "clicked" or not 0 < item_id <= len(self.entries):
            return
        action = self.entries[item_id - 1].action
        if action is not None:
            GLib.idle_add(self._run, action)

    @staticmethod
    def _run(action: Callable[[], None]) -> bool:
        action()
        return GLib.SOURCE_REMOVE


def watcher_available(connection: Gio.DBusConnection) -> bool:
    try:
        reply = connection.call_sync(
            "org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus", "NameHasOwner",
            GLib.Variant("(s)", (WATCHER_NAME,)), GLib.VariantType("(b)"), Gio.DBusCallFlags.NONE, 1000, None,
        )
    except GLib.Error:
        return False
    return bool(reply.unpack()[0])
