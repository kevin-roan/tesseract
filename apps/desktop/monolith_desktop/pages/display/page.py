import time

from gi.repository import Adw, Gdk, Gio, GLib, Gtk

from ...api.errors import describe_error
from ...api.types import DisplayStatus
from ...viewmodels import EmptyModel
from ...vnc.client import CursorImage, RfbEvents
from ...vnc.framebuffer import Rect
from ...vnc.input import KEY_COMBOS, combo_events
from ...vnc.session import SessionState, VncSession
from ...vnc.view import VncView
from ...widgets import EmptyState
from ..base import Page
from . import model
from .fullscreen import FullscreenHost
from .labels import ACTIONS, KEY_COMBOS as KEY_LABELS, MENU, PREVIEW, SCREENSHOT_FILE, SCREENSHOT_FILTER, SCREENSHOT_STAMP, TITLE, TOASTS
from .preview import ScreenshotPreview
from .stage import DisplayStage
from .toolbar import (
    SCALE_ACTUAL,
    SCALE_FIT,
    DisplayToolbar,
    ScaleToggle,
    action_button,
    action_toggle,
    menu_button,
    target_menu,
)


class _ViewEvents(RfbEvents):
    def __init__(self, page: "DisplayPage") -> None:
        self._page = page

    def on_connected(self, name: str, width: int, height: int) -> None:
        self._page.attach_framebuffer()

    def on_resize(self, width: int, height: int) -> None:
        self._page.attach_framebuffer()

    def on_update(self, damage: list[Rect]) -> None:
        self._page.view.invalidate(damage)

    def on_bell(self) -> None:
        self._page.view.error_bell()

    def on_cut_text(self, text: str) -> None:
        self._page.receive_clipboard(text)

    def on_cursor(self, cursor: CursorImage) -> None:
        self._page.view.set_remote_cursor(cursor)


class DisplayPage(Page):
    id = "display"
    title = TITLE
    icon = "display"
    section = "sandbox"
    order = 40

    def build(self) -> Gtk.Widget:
        self._shown = False
        self._mode: model.Mode = "loading"
        self._status: DisplayStatus | None = None
        self._status_error: str | None = None
        self._clipboard_sync = True
        self._clipboard_text: str | None = None
        self._tick_source: int | None = None

        self.session = VncSession(lambda: self.ctx.client, _ViewEvents(self))
        self.view = VncView({model.FULLSCREEN_KEY: self._toggle_fullscreen})
        self.view.set_sink(self.session)
        self.view.on_focus_in = self._push_clipboard
        self.view.on_scale_changed = lambda _scale: self._render()
        self._stage = DisplayStage(self.view, self._on_overlay_action)
        self._fullscreen = FullscreenHost(
            model.EXIT_FULLSCREEN_ICON, ACTIONS["exit_fullscreen"], model.EXIT_KEYS, self._exit_fullscreen
        )

        self._actions = self._build_actions()
        self._toolbar = self._build_toolbar()
        self._empty = EmptyState("")
        self._preview = ScreenshotPreview(
            PREVIEW["title"], model.preview_message(), PREVIEW["action"], PREVIEW["loading"], self._check_again
        )
        self._stage_holder = Gtk.Box(css_classes=["to-display-holder"])
        self._stage_holder.append(self._stage)
        self._stack = Gtk.Stack(transition_type=Gtk.StackTransitionType.CROSSFADE, vexpand=True, hexpand=True)
        self._stack.add_named(self._empty, "empty")
        self._stack.add_named(self._preview, "preview")
        self._stack.add_named(self._stage_holder, "viewer")

        root = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, css_classes=["to-display-page"])
        root.append(self._toolbar)
        root.append(self._stack)
        root.insert_action_group(model.ACTION_GROUP, self._actions)
        shortcuts = Gtk.ShortcutController(scope=Gtk.ShortcutScope.LOCAL)
        shortcuts.add_shortcut(
            Gtk.Shortcut(
                trigger=Gtk.KeyvalTrigger(keyval=model.FULLSCREEN_KEY, modifiers=0),
                action=Gtk.CallbackAction.new(lambda *_: self._toggle_fullscreen() or True),
            )
        )
        root.add_controller(shortcuts)

        self._status_poller = self.ctx.poll(
            lambda client: client.display_status(), model.STATUS_INTERVAL_S, self._on_status, self._on_status_error
        )
        self._screenshot_poller = self.ctx.poll(
            lambda client: client.screenshot(), model.SCREENSHOT_INTERVAL_S, self._preview.show_png
        )
        self._clipboard = root.get_clipboard()
        self._clipboard_handler = self._clipboard.connect("changed", lambda *_: self._push_clipboard())

        store = self.ctx.store
        store.connection.bind(root, lambda _state: self._sync())
        store.window_visible.bind(root, lambda _visible: self._sync())
        self.session.state.bind(root, self._on_session_state)
        root.connect("destroy", lambda *_: self._shutdown())
        width, height = model.MIN_SIZE
        compact = Adw.Breakpoint.new(Adw.BreakpointCondition.parse(model.COMPACT_CONDITION))
        self._toolbar.compact_setters(compact)
        container = Adw.BreakpointBin(child=root, width_request=width, height_request=height)
        container.add_breakpoint(compact)
        return container

    def _build_toolbar(self) -> DisplayToolbar:
        toolbar = DisplayToolbar()
        self._scale = ScaleToggle(
            {
                SCALE_FIT: (ACTIONS["fit"], ACTIONS["fit_tooltip"]),
                SCALE_ACTUAL: (ACTIONS["actual"], ACTIONS["actual_tooltip"]),
            },
            self._stage.set_fit,
        )
        keys = target_menu(self._action("keys"), KEY_LABELS.items())
        self._keys_button = menu_button("keyboard", ACTIONS["keys"], keys)
        toolbar.add(self._scale)
        toolbar.add(action_toggle(self._action("view_only"), model.VIEW_ONLY_ICON, ACTIONS["view_only"]), secondary=True)
        toolbar.add(action_toggle(self._action("clipboard"), model.CLIPBOARD_ICON, ACTIONS["clipboard"]), secondary=True)
        toolbar.add(self._keys_button, secondary=True)
        toolbar.add_separator()
        toolbar.add(action_button(self._action("screenshot"), "screenshot", ACTIONS["screenshot"]), secondary=True)
        toolbar.add(action_button(self._action("browser"), "browser", ACTIONS["browser"]), secondary=True)
        toolbar.add(action_button(self._action("reconnect"), "refresh", ACTIONS["reconnect"]))
        toolbar.add(action_button(self._action("fullscreen"), "fullscreen", ACTIONS["fullscreen"]))
        toolbar.add(menu_button(model.OVERFLOW_ICON, MENU["more"], self._overflow_menu(keys)), overflow=True)
        return toolbar

    def _overflow_menu(self, keys: Gio.Menu) -> Gio.Menu:
        menu = Gio.Menu()
        toggles = Gio.Menu()
        toggles.append(MENU["view_only"], self._action("view_only"))
        toggles.append(MENU["clipboard"], self._action("clipboard"))
        toggles.append_submenu(MENU["keys"], keys)
        menu.append_section(None, toggles)
        tools = Gio.Menu()
        tools.append(MENU["screenshot"], self._action("screenshot"))
        tools.append(MENU["browser"], self._action("browser"))
        menu.append_section(None, tools)
        return menu

    @staticmethod
    def _action(action_id: str) -> str:
        return f"{model.ACTION_GROUP}.{model.ACTION_NAMES[action_id]}"

    def _build_actions(self) -> Gio.SimpleActionGroup:
        group = Gio.SimpleActionGroup()
        handlers = {
            "screenshot": self._save_screenshot,
            "browser": self._open_browser,
            "reconnect": self._reconnect,
            "fullscreen": self._toggle_fullscreen,
        }
        for action_id, handler in handlers.items():
            action = Gio.SimpleAction.new(model.ACTION_NAMES[action_id], None)
            action.connect("activate", lambda _action, _param, run=handler: run())
            group.add_action(action)
        toggles = {"view_only": (False, self.view.set_view_only), "clipboard": (True, self._set_clipboard_sync)}
        for action_id, (initial, handler) in toggles.items():
            action = Gio.SimpleAction.new_stateful(model.ACTION_NAMES[action_id], None, GLib.Variant.new_boolean(initial))
            action.connect("change-state", lambda action, value, run=handler: (action.set_state(value), run(value.get_boolean())))
            group.add_action(action)
        keys = Gio.SimpleAction.new(model.ACTION_NAMES["keys"], GLib.VariantType.new("s"))
        keys.connect("activate", lambda _action, target: self._send_combo(target.get_string()))
        group.add_action(keys)
        return group

    def _set_enabled(self, enabled: frozenset[str]) -> None:
        for action_id, name in model.ACTION_NAMES.items():
            action = self._actions.lookup_action(name)
            if action is not None:
                action.set_enabled(action_id in enabled)
        self._scale.set_sensitive("scale" in enabled)
        self._keys_button.set_sensitive("keys" in enabled)

    def on_shown(self) -> None:
        self._shown = True
        self._sync()

    def on_hidden(self) -> None:
        self._shown = False
        self._exit_fullscreen()
        self._sync()

    def attach_framebuffer(self) -> None:
        self.view.set_framebuffer(self.session.framebuffer)

    def _active(self) -> bool:
        visible = self.ctx.store.window_visible.value or self._fullscreen.active
        return self._shown and visible and self.ctx.store.connection.value.online

    def _sync(self) -> None:
        connection = self.ctx.store.connection.value
        self._mode = model.mode_for(connection, self._status, self._status_error)
        if not self._active():
            self.session.stop()
            self._status_poller.stop()
            self._screenshot_poller.stop()
            if not connection.online:
                self._status = None
                self._status_error = None
                self._mode = "offline"
                self._exit_fullscreen()
        elif self._mode == "viewer":
            self._status_poller.stop()
            self._screenshot_poller.stop()
            self.session.start()
        else:
            self.session.stop()
            self._status_poller.start()
            if self._mode == "preview":
                self._screenshot_poller.start()
            else:
                self._screenshot_poller.stop()
                self._preview.clear()
        self._render()

    def _on_status(self, status: DisplayStatus) -> None:
        self._status = status
        self._status_error = None
        self._sync()

    def _on_status_error(self, error: BaseException) -> None:
        self._status_error = describe_error(error)
        self._status = None
        self._sync()

    def _on_session_state(self, state: SessionState) -> None:
        if state.status is not None:
            self._status = state.status
        if state.phase == "unavailable":
            self._sync()
            return
        self._schedule_tick(state.phase == "retrying")
        self._render()

    def _schedule_tick(self, enabled: bool) -> None:
        if enabled and self._tick_source is None:
            self._tick_source = GLib.timeout_add_seconds(model.TICK_S, self._tick)
        elif not enabled and self._tick_source is not None:
            GLib.source_remove(self._tick_source)
            self._tick_source = None

    def _tick(self) -> bool:
        self._render()
        return GLib.SOURCE_CONTINUE

    def _render(self) -> None:
        mode = self._mode
        state = self.session.state.value
        label, tone = model.badge(mode, state)
        self._toolbar.set_status(label, tone)
        self._toolbar.set_meta(model.meta_text(mode, state, self._status, self.view.scale))
        self._set_enabled(model.enabled_actions(mode, state))
        empty = model.empty_model(mode, self.ctx.store.connection.value, self._status, self._status_error)
        if empty is not None:
            self._show_empty(empty)
        elif mode == "preview":
            self._stack.set_visible_child_name("preview")
        else:
            self._stack.set_visible_child_name("viewer")
            overlay = model.overlay_model(state, time.monotonic()) if not state.connected else None
            self._stage.set_overlay(overlay)

    def _show_empty(self, empty: EmptyModel) -> None:
        self._empty.set_content(
            empty.title,
            empty.message,
            empty.icon,
            empty.loading,
            empty.action_label,
            self._check_again if empty.action else None,
        )
        self._stack.set_visible_child_name("empty")

    def _check_again(self) -> None:
        if not self.ctx.store.connection.value.online:
            self.ctx.connection.refresh()
            return
        self._status_error = None
        self._status_poller.refresh()
        self._render()

    def _on_overlay_action(self) -> None:
        if self.session.state.value.phase == "unavailable":
            self._check_again()
        else:
            self.session.reconnect()

    def _reconnect(self) -> None:
        if self._mode == "viewer":
            self.session.reconnect()
        else:
            self._check_again()

    def _send_combo(self, combo: str) -> None:
        keysyms = KEY_COMBOS.get(combo)
        if not keysyms or self.view.view_only:
            return
        for keysym, down in combo_events(keysyms):
            self.session.key(keysym, down)
        self.view.grab_focus()

    def _set_clipboard_sync(self, enabled: bool) -> None:
        self._clipboard_sync = enabled
        if enabled:
            self._push_clipboard()

    def receive_clipboard(self, text: str) -> None:
        if not self._clipboard_sync or not text or text == self._clipboard_text:
            return
        self._clipboard_text = text
        self._clipboard.set_content(Gdk.ContentProvider.new_for_value(text))

    def _push_clipboard(self) -> None:
        if not self._clipboard_sync or not self.session.state.value.connected or self.view.view_only:
            return
        self._clipboard.read_text_async(None, self._on_local_text)

    def _on_local_text(self, clipboard: Gdk.Clipboard, result: Gio.AsyncResult) -> None:
        try:
            text = clipboard.read_text_finish(result)
        except GLib.Error:
            return
        if text and text != self._clipboard_text:
            self._clipboard_text = text
            self.session.cut_text(text)

    def _window(self) -> Gtk.Window | None:
        root = self.view.get_root()
        return root if isinstance(root, Gtk.Window) else self.ctx.window

    def _save_screenshot(self) -> None:
        self.ctx.call(
            lambda client: client.screenshot(),
            on_success=self._choose_screenshot_file,
            on_error=lambda error: self.ctx.toast(TOASTS["screenshot_failed"].format(error=describe_error(error))),
        )

    def _choose_screenshot_file(self, data: bytes) -> None:
        png = Gtk.FileFilter(name=SCREENSHOT_FILTER)
        png.add_mime_type(model.PNG_MIME)
        filters = Gio.ListStore.new(Gtk.FileFilter)
        filters.append(png)
        dialog = Gtk.FileDialog(
            title=ACTIONS["screenshot"],
            initial_name=SCREENSHOT_FILE.format(stamp=time.strftime(SCREENSHOT_STAMP)),
            filters=filters,
            default_filter=png,
        )
        dialog.save(self._window(), None, lambda dialog, result: self._write_screenshot(dialog, result, data))

    def _write_screenshot(self, dialog: Gtk.FileDialog, result: Gio.AsyncResult, data: bytes) -> None:
        try:
            file = dialog.save_finish(result)
        except GLib.Error:
            return
        if file is None:
            return
        file.replace_contents_bytes_async(
            GLib.Bytes.new(data), None, False, Gio.FileCreateFlags.REPLACE_DESTINATION, None, self._screenshot_written
        )

    def _screenshot_written(self, file: Gio.File, result: Gio.AsyncResult) -> None:
        try:
            file.replace_contents_finish(result)
        except GLib.Error as error:
            self.ctx.toast(TOASTS["screenshot_failed"].format(error=error.message))
            return
        self.ctx.toast(TOASTS["screenshot_saved"].format(name=file.get_basename()))

    def _open_browser(self) -> None:
        self.ctx.call(
            lambda client: client.vnc_page_url(),
            on_success=self._launch_uri,
            on_error=lambda error: self.ctx.toast(TOASTS["browser_failed"].format(error=describe_error(error))),
        )

    def _launch_uri(self, uri: str) -> None:
        launcher = Gtk.UriLauncher(uri=uri)
        launcher.launch(self._window(), None, self._uri_launched)

    def _uri_launched(self, launcher: Gtk.UriLauncher, result: Gio.AsyncResult) -> None:
        try:
            launcher.launch_finish(result)
        except GLib.Error as error:
            if not error.matches(Gtk.dialog_error_quark(), Gtk.DialogError.DISMISSED):
                self.ctx.toast(TOASTS["browser_failed"].format(error=error.message))

    def _toggle_fullscreen(self) -> None:
        if self._fullscreen.active:
            self._exit_fullscreen()
        elif self._mode == "viewer":
            self._stage_holder.remove(self._stage)
            self._fullscreen.enter(self._stage, self.ctx.window)
            self.view.grab_focus()

    def _exit_fullscreen(self) -> None:
        if not self._fullscreen.active:
            return
        self._fullscreen.leave()
        self._stage_holder.append(self._stage)
        self._sync()

    def _shutdown(self) -> None:
        self._schedule_tick(False)
        self._exit_fullscreen()
        self.session.stop()
        self._status_poller.stop()
        self._screenshot_poller.stop()
        if self._clipboard_handler:
            self._clipboard.disconnect(self._clipboard_handler)
            self._clipboard_handler = 0
