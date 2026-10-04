import logging
import os
import sys
from typing import Any

IGNORED_ENV = ("GTK_THEME",)
# `--hidden` at login can start before the panel's tray: wait this long for it before showing the window.
TRAY_WAIT_S = 10


def _sanitize_environment() -> None:
    for name in IGNORED_ENV:
        os.environ.pop(name, None)


_sanitize_environment()

import gi  # noqa: E402

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")
from gi.repository import Adw, Gdk, Gio, GLib, Gtk  # noqa: E402

from . import APP_ID, APP_NAME, VERSION, tray  # noqa: E402
from .api import tasks  # noqa: E402
from .config.storage import migrate_legacy_config, read_settings, write_settings  # noqa: E402
from .context import AppContext  # noqa: E402
from .paths import ICONS_DIR  # noqa: E402
from .services.connection import ConnectionService  # noqa: E402
from .store import AppStore  # noqa: E402
from .strings import ABOUT, ZOOM_TOAST  # noqa: E402
from .theme.manager import theme  # noqa: E402

log = logging.getLogger("monolith_desktop")

ACCELERATORS = {
    "app.quit": ["<Control>q"],
    "app.preferences": ["<Control>comma"],
    "app.refresh": ["<Control>r", "F5"],
    "app.hide": ["<Control>w"],
    "app.new-conversation": ["<Control>n"],
    "app.zoom-in": ["<Control>plus", "<Control>equal", "<Control>KP_Add"],
    "app.zoom-out": ["<Control>minus", "<Control>KP_Subtract"],
    "app.zoom-reset": ["<Control>0", "<Control>KP_0"],
}
ZOOM_SETTING = "zoom"


class MonolithApplication(Adw.Application):
    def __init__(self) -> None:
        super().__init__(application_id=APP_ID, flags=Gio.ApplicationFlags.HANDLES_COMMAND_LINE)
        GLib.set_application_name(APP_NAME)
        self.hide_on_close = False
        self.tray_attached = False
        self.tray_item: Any = None
        self.ctx: AppContext | None = None
        self.window: Any = None
        self._held = False
        self._first_command = True
        self.add_main_option("hidden", 0, GLib.OptionFlags.NONE, GLib.OptionArg.NONE, "Start in the tray without a window", None)
        self.add_main_option("page", 0, GLib.OptionFlags.NONE, GLib.OptionArg.STRING, "Open a page by id", "ID")
        self.add_main_option("quit", 0, GLib.OptionFlags.NONE, GLib.OptionArg.NONE, "Quit the running instance", None)
        self.add_main_option("debug", 0, GLib.OptionFlags.NONE, GLib.OptionArg.NONE, "Verbose logging", None)
        self.add_main_option("sync", 0, GLib.OptionFlags.NONE, GLib.OptionArg.NONE, "Copy the current directory to the sandbox and exit", None)
        self.add_main_option("confidential", 0, GLib.OptionFlags.NONE, GLib.OptionArg.NONE, "With --sync: send the project under a pseudonym and keep its name on this computer", None)
        self.add_main_option("pull", 0, GLib.OptionFlags.NONE, GLib.OptionArg.NONE, "Copy sandbox changes back into the current directory and exit", None)
        self.add_main_option("dry-run", 0, GLib.OptionFlags.NONE, GLib.OptionArg.NONE, "With --pull: show what would change, write nothing", None)
        self.add_main_option("force", 0, GLib.OptionFlags.NONE, GLib.OptionArg.NONE, "With --pull/--revert: overwrite files edited on the host", None)
        self.add_main_option("revert", 0, GLib.OptionFlags.NONE, GLib.OptionArg.NONE, "Undo the last --pull in the current directory and exit", None)
        self.add_main_option("sync-status", 0, GLib.OptionFlags.NONE, GLib.OptionArg.NONE, "Show sandbox changes and sync-back snapshots and exit", None)
        self.add_main_option("get", 0, GLib.OptionFlags.NONE, GLib.OptionArg.NONE, "Runs inside the sandbox; on this computer use --sync", None)

    def do_handle_local_options(self, options: GLib.VariantDict) -> int:
        if options.contains("get"):
            from .syncback.cli import run_get_on_host

            return run_get_on_host()
        if options.contains("sync"):
            from .sync import run_sync

            return run_sync(os.getcwd(), confidential=options.contains("confidential"))
        if options.contains("pull") or options.contains("revert") or options.contains("sync-status"):
            return self._run_sync_back(options)
        return -1

    def _run_sync_back(self, options: GLib.VariantDict) -> int:
        from .pages.projects.model import project_id_from_name
        from .sync import connect_client
        from .syncback.cli import run_pull, run_revert, run_status

        cwd, force = os.getcwd(), options.contains("force")
        if options.contains("pull"):
            return run_pull(cwd, connect_client, project_id_from_name, options.contains("dry-run"), force)
        if options.contains("revert"):
            return run_revert(cwd, project_id_from_name, force, client_factory=connect_client)
        return run_status(cwd, connect_client, project_id_from_name)

    def do_startup(self) -> None:
        Adw.Application.do_startup(self)
        display = Gdk.Display.get_default()
        if display is not None:
            Gtk.IconTheme.get_for_display(display).add_search_path(str(ICONS_DIR))
        Gtk.Window.set_default_icon_name(APP_ID)
        migrate_legacy_config()
        zoom = read_settings().get(ZOOM_SETTING)
        if isinstance(zoom, (int, float)):
            theme().set_zoom(float(zoom))
        theme().install(display)
        store = AppStore()
        self.ctx = AppContext(self, store, ConnectionService(store), theme())
        self._install_actions()
        self.ctx.connection.start()
        self.ctx.host_shell.start_if_enabled()
        self.tray_attached = tray.attach(self)
        if self.tray_attached:
            self.set_hide_on_close(True)

    def do_command_line(self, command_line: Gio.ApplicationCommandLine) -> int:
        options = command_line.get_options_dict().end().unpack()
        if options.get("debug"):
            logging.getLogger().setLevel(logging.DEBUG)
        if options.get("quit"):
            self.quit_app()
            return 0
        first = self._first_command
        self._first_command = False
        hidden = bool(options.get("hidden")) and first
        if hidden and self.tray_attached:
            self.ensure_window()
        elif hidden and self.tray_item is not None:
            self.ensure_window()
            self.hold()
            GLib.timeout_add_seconds(TRAY_WAIT_S, self._tray_wait_done)
        else:
            if hidden:
                log.info("--hidden ignored: no tray is available")
            self.show_window()
        if options.get("page"):
            self.navigate(options["page"])
        return 0

    def do_activate(self) -> None:
        self.show_window()

    def do_shutdown(self) -> None:
        if self.ctx:
            self.ctx.workspace.stop()
            self.ctx.syncback.stop()
            self.ctx.host_shell.shutdown()
            self.ctx.connection.stop()
        tray.detach(self)
        tasks.shutdown()
        Adw.Application.do_shutdown(self)

    def tray_host_changed(self, available: bool) -> None:
        """The panel's tray started or went away: closing the window hides it only while the icon is shown."""
        lost = self.tray_attached and not available
        self.tray_attached = available
        self.set_hide_on_close(available)
        if lost and self.window is not None and not self.window.get_visible():
            self.show_window()

    def _tray_wait_done(self) -> bool:
        self.release()
        if not self.tray_attached:
            log.info("--hidden ignored: no tray appeared")
            self.show_window()
        return GLib.SOURCE_REMOVE

    def ensure_window(self):
        if self.window is None:
            from .window import MainWindow

            self.window = MainWindow(self, self.ctx)
        return self.window

    def show_window(self) -> None:
        self.ensure_window().present()

    def hide_window(self) -> None:
        if self.window is not None:
            self.window.set_visible(False)

    def toggle_window(self) -> None:
        if self.window is not None and self.window.get_visible():
            self.hide_window()
        else:
            self.show_window()

    def navigate(self, page_id: str, params: dict[str, Any] | None = None, show: bool = True) -> bool:
        window = self.ensure_window()
        if show:
            window.present()
        return window.navigate(page_id, params)

    def set_hide_on_close(self, enabled: bool) -> None:
        self.hide_on_close = enabled
        if enabled and not self._held:
            self.hold()
            self._held = True
        elif not enabled and self._held:
            self.release()
            self._held = False

    def quit_app(self) -> None:
        if self._held:
            self.release()
            self._held = False
        for window in self.get_windows():
            window.destroy()
        self.quit()

    def _install_actions(self) -> None:
        simple = {
            "show": lambda *_: self.show_window(),
            "hide": lambda *_: self._close_window(),
            "toggle": lambda *_: self.toggle_window(),
            "quit": lambda *_: self.quit_app(),
            "preferences": lambda *_: self._with_window(lambda: self.ctx.open_preferences()),
            "about": lambda *_: self._with_window(self._show_about),
            "refresh": lambda *_: self.ctx.connection.refresh(),
            "rediscover": lambda *_: self.ctx.connection.rediscover(),
            "pair": lambda *_: self._with_window(self._show_pairing),
            "pair-host": lambda *_: self._with_window(lambda: self._show_pairing("host")),
            "new-conversation": lambda *_: self._with_window(lambda: self.window.new_conversation()),
            "zoom-in": lambda *_: self._zoom(1),
            "zoom-out": lambda *_: self._zoom(-1),
            "zoom-reset": lambda *_: self._zoom(0),
        }
        for name, handler in simple.items():
            action = Gio.SimpleAction.new(name, None)
            action.connect("activate", handler)
            self.add_action(action)
        navigate = Gio.SimpleAction.new("navigate", GLib.VariantType.new("s"))
        navigate.connect("activate", lambda _action, param: self.navigate(param.get_string()))
        self.add_action(navigate)
        for action, accels in ACCELERATORS.items():
            self.set_accels_for_action(action, accels)

    def _zoom(self, direction: int) -> None:
        zoom = theme().step_zoom(direction)
        settings = read_settings()
        settings[ZOOM_SETTING] = zoom
        try:
            write_settings(settings)
        except OSError:
            log.warning("could not save zoom level", exc_info=True)
        if self.ctx:
            self.ctx.toast(ZOOM_TOAST.format(percent=round(zoom * 100)))

    def _close_window(self) -> None:
        if self.window is not None:
            self.window.close()

    def _with_window(self, fn) -> None:
        self.show_window()
        fn()

    def _show_pairing(self, target: str = "sandbox") -> None:
        from .widgets.pair_dialog import show_pairing

        show_pairing(self.ctx, target)

    def _show_about(self) -> None:
        about = Adw.AboutDialog(
            application_name=APP_NAME,
            application_icon=APP_ID,
            version=VERSION,
            developer_name=ABOUT["developer"],
            comments=ABOUT["comments"],
        )
        about.present(self.window)


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(
        level=os.environ.get("MONOLITH_DESKTOP_LOG", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    app = MonolithApplication()
    return app.run(sys.argv if argv is None else argv)
