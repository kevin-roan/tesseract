import shutil
import subprocess

import pytest

gi = pytest.importorskip("gi")
gi.require_version("Gio", "2.0")
from gi.repository import Gio, GLib  # noqa: E402

from tesseract_desktop import APP_ID  # noqa: E402
from tesseract_desktop.store import ConnectionState  # noqa: E402
from tesseract_desktop.tray import tooltip  # noqa: E402
from tesseract_desktop.tray.sni import (  # noqa: E402
    ITEM_PATH,
    MENU_PATH,
    WATCHER_NAME,
    WATCHER_PATH,
    MenuEntry,
    StatusNotifierItem,
    argb_pixmaps,
    menu_layout,
    register_object,
    watcher_available,
)

WATCHER_XML = """
<node><interface name="org.kde.StatusNotifierWatcher">
  <method name="RegisterStatusNotifierItem"><arg name="service" type="s" direction="in"/></method>
</interface></node>
"""


def test_layout_lists_entries_and_separators():
    revision, (root_id, root_props, children) = menu_layout([MenuEntry("Open"), MenuEntry(None), MenuEntry("Quit")], 7).unpack()
    assert (revision, root_id, root_props) == (7, 0, {"children-display": "submenu"})
    assert [(child[0], child[1]) for child in children] == [
        (1, {"label": "Open", "enabled": True, "visible": True}),
        (2, {"type": "separator"}),
        (3, {"label": "Quit", "enabled": True, "visible": True}),
    ]


def test_layout_children_are_boxed_once():
    layout = menu_layout([MenuEntry("Open"), MenuEntry("Quit")], 1)
    children = layout.get_child_value(1).get_child_value(2)
    for index in range(children.n_children()):
        assert children.get_child_value(index).get_variant().get_type_string() == "(ia{sv}av)"


def test_icon_pixmaps_are_argb_in_network_order(tmp_path):
    svg = tmp_path / "dot.svg"
    svg.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="#ff0000"/></svg>')
    [(width, height, data)] = argb_pixmaps(str(svg), (4,))
    assert (width, height, len(data)) == (4, 4, 64)
    assert data[:4] == bytes((255, 255, 0, 0))
    assert argb_pixmaps()  # the real app icon renders


def test_tooltip_shows_the_connection_status():
    assert tooltip(ConnectionState(status="online")) == "Tesseract · Online"


def connect(address):
    flags = Gio.DBusConnectionFlags.AUTHENTICATION_CLIENT | Gio.DBusConnectionFlags.MESSAGE_BUS_CONNECTION
    return Gio.DBusConnection.new_for_address_sync(address, flags, None, None)


@pytest.fixture
def buses():
    """The app's connection and a panel-side client connection on a private bus."""
    if not shutil.which("dbus-daemon"):
        pytest.skip("needs dbus-daemon")
    daemon = subprocess.Popen(["dbus-daemon", "--session", "--nofork", "--print-address"], stdout=subprocess.PIPE, text=True)
    try:
        address = daemon.stdout.readline().strip()
        app, panel = connect(address), connect(address)
        yield app, panel
        for connection in (app, panel):
            connection.close_sync(None)
    finally:
        daemon.terminate()
        daemon.wait(timeout=5)


def spin(until, timeout=2.0):
    context = GLib.MainContext.default()
    deadline = GLib.get_monotonic_time() + int(timeout * 1_000_000)
    while not until() and GLib.get_monotonic_time() < deadline:
        context.iteration(False)
    return until()


def fake_watcher(connection):
    registered = []

    def call(_c, sender, _p, _i, _m, params, invocation):
        registered.append((sender, params.unpack()[0]))
        invocation.return_value(None)

    info = Gio.DBusNodeInfo.new_for_xml(WATCHER_XML).interfaces[0]
    register_object(connection, WATCHER_PATH, info, call, None)
    owned = []
    Gio.bus_own_name_on_connection(connection, WATCHER_NAME, Gio.BusNameOwnerFlags.NONE, lambda *_: owned.append(True), None)
    assert spin(lambda: owned)
    return registered


def call(panel, item, path, interface, method, params, reply):
    """Calls the app from the panel connection asynchronously, so the app's handlers run on this loop."""
    done = []
    panel.call(item, path, interface, method, params, GLib.VariantType(reply), Gio.DBusCallFlags.NONE, 2000, None, lambda c, r: done.append(c.call_finish(r)))
    assert spin(lambda: done)
    return done[0].unpack()


def test_registers_with_the_watcher_and_serves_icon_and_menu(buses):
    bus, panel = buses
    assert not watcher_available(bus)
    registered = fake_watcher(panel)
    assert watcher_available(bus)

    clicked, toggled = [], []
    item = StatusNotifierItem(bus, [MenuEntry("Open", lambda: clicked.append("open")), MenuEntry(None), MenuEntry("Quit", lambda: clicked.append("quit"))], lambda: toggled.append(True))
    item.start()
    try:
        assert spin(lambda: registered)
        assert registered[0][1] == item.bus_name

        props = call(panel, item.bus_name, ITEM_PATH, "org.freedesktop.DBus.Properties", "GetAll", GLib.Variant("(s)", ("org.kde.StatusNotifierItem",)), "(a{sv})")[0]
        assert props["Id"] == APP_ID and props["IconName"] == APP_ID and props["Menu"] == MENU_PATH and props["Status"] == "Active"
        assert props["IconPixmap"]

        _revision, (_root, _props, children) = call(panel, item.bus_name, MENU_PATH, "com.canonical.dbusmenu", "GetLayout", GLib.Variant("(iias)", (0, -1, [])), "(u(ia{sv}av))")
        assert [child[1].get("label") for child in children] == ["Open", None, "Quit"]

        call(panel, item.bus_name, MENU_PATH, "com.canonical.dbusmenu", "Event", GLib.Variant("(isvu)", (3, "clicked", GLib.Variant("s", ""), 0)), "()")
        call(panel, item.bus_name, ITEM_PATH, "org.kde.StatusNotifierItem", "Activate", GLib.Variant("(ii)", (0, 0)), "()")
        assert spin(lambda: clicked and toggled)
        assert clicked == ["quit"]

        item.set_tooltip("Tesseract · Online")
        tip = call(panel, item.bus_name, ITEM_PATH, "org.freedesktop.DBus.Properties", "Get", GLib.Variant("(ss)", ("org.kde.StatusNotifierItem", "ToolTip")), "(v)")[0]
        assert tip[2:] == ("Tesseract", "Tesseract · Online")
    finally:
        item.stop()


def test_registers_when_the_tray_starts_after_the_app(buses):
    bus, panel = buses
    hosts = []
    item = StatusNotifierItem(bus, [MenuEntry("Open")], lambda: None, hosts.append)
    item.start()
    try:
        assert spin(lambda: hosts == [False])
        registered = fake_watcher(panel)
        assert spin(lambda: registered and hosts == [False, True])
        assert registered[0][1] == item.bus_name
    finally:
        item.stop()
