from collections.abc import Callable
from typing import TYPE_CHECKING

from gi.repository import Gtk

from ...api.errors import describe_error
from ...api.types import DisplayWindow, DisplayWindowList
from ...widgets import EmptyState, Icon, IconButton, Text
from ...widgets.confirm_dialog import confirm
from ...widgets.keyed_list import KeyedList
from ...widgets.motion import crossfade_stack
from ...widgets.record_row import RecordRow, RowAction
from . import model
from .labels import ACTIONS, TOASTS, WINDOWS

if TYPE_CHECKING:
    from ...context import AppContext

POPOVER_WIDTH = 400
MAX_LIST_HEIGHT = 380
WINDOW_ICON = "app-window"


class WindowsPopover(Gtk.Popover):
    """The apps on the sandbox display, polled while open: click one to focus it, close or force quit it."""

    def __init__(self, ctx: "AppContext", on_focused: Callable[[], None]) -> None:
        super().__init__(has_arrow=False)
        self._ctx = ctx
        self._on_focused = on_focused
        self._busy: str | None = None
        self._windows: list[DisplayWindow] | None = None

        header = Gtk.Box(spacing=8, margin_start=8, margin_end=2)
        title = Text(WINDOWS["title"], "overline", "textTertiary")
        title.set_hexpand(True)
        header.append(title)
        header.append(IconButton("refresh", WINDOWS["refresh"], self.refresh))

        self._list = KeyedList(self._create_row, self._update_row)
        self._state = EmptyState("")
        for side in ("top", "bottom"):
            getattr(self._state, f"set_margin_{side}")(20)
        self._stack = crossfade_stack(vhomogeneous=False, hhomogeneous=False)
        self._stack.add_named(self._state, "state")
        self._stack.add_named(
            Gtk.ScrolledWindow(
                child=self._list,
                hscrollbar_policy=Gtk.PolicyType.NEVER,
                propagate_natural_height=True,
                max_content_height=MAX_LIST_HEIGHT,
            ),
            "list",
        )

        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4, width_request=POPOVER_WIDTH)
        box.append(header)
        box.append(self._stack)
        self.set_child(box)

        self._poller = ctx.poll(lambda client: client.display_windows(), model.WINDOWS_INTERVAL_S, self._on_windows, self._on_error)
        self.connect("show", lambda *_: self._opened())
        self.connect("closed", lambda *_: self._poller.stop())
        self.connect("destroy", lambda *_: self._poller.stop())

    def refresh(self) -> None:
        self._poller.refresh()

    def _opened(self) -> None:
        if self._windows is None:
            self._state.set_content(WINDOWS["loading"], None, None, True)
            self._stack.set_visible_child_name("state")
        self._poller.start()

    def _on_windows(self, result: DisplayWindowList) -> None:
        self._windows = model.windows_in_order(result["windows"])
        self._render()

    def _on_error(self, error: BaseException) -> None:
        self._windows = None
        self._state.set_content(WINDOWS["error_title"], describe_error(error), "warning", False, WINDOWS["refresh"], self.refresh)
        self._stack.set_visible_child_name("state")

    def _render(self) -> None:
        windows = self._windows or []
        self._list.sync((window["id"], window) for window in windows)
        if windows:
            self._stack.set_visible_child_name("list")
        else:
            self._state.set_content(WINDOWS["empty_title"], WINDOWS["empty_message"], WINDOW_ICON, False)
            self._stack.set_visible_child_name("state")

    @staticmethod
    def _create_row() -> RecordRow:
        return RecordRow(WINDOW_ICON)

    def _update_row(self, row: RecordRow, window: DisplayWindow) -> None:
        idle = self._busy is None
        row.set_icon(WINDOW_ICON, "accent" if window["active"] else "textSecondary")
        row.set_content(model.window_title(window), window.get("app"), model.window_state(window))
        row.set_on_activate((lambda: self._activate(window)) if idle else None)
        row.set_actions([
            RowAction("close", "close", WINDOWS["close"], lambda: self._close(window, False), sensitive=idle),
            RowAction("force", "failed", WINDOWS["force"], lambda: self._confirm_force(window), sensitive=idle, destructive=True),
        ])

    def _activate(self, window: DisplayWindow) -> None:
        self._run(window, lambda client: client.activate_display_window(window["id"]), self._focused)

    def _focused(self) -> None:
        self.popdown()
        self._on_focused()

    def _close(self, window: DisplayWindow, force: bool) -> None:
        self._run(window, lambda client: client.close_display_window(window["id"], force), self.refresh)

    def _confirm_force(self, window: DisplayWindow) -> None:
        parent = self.get_root()
        self.popdown()
        confirm(
            parent if isinstance(parent, Gtk.Widget) else None,
            WINDOWS["force_title"],
            WINDOWS["force_message"],
            WINDOWS["force"],
            WINDOWS["cancel"],
            lambda: self._close(window, True),
        )

    def _run(self, window: DisplayWindow, fn: Callable, on_success: Callable[[], None]) -> None:
        self._busy = window["id"]
        self._render()
        self._ctx.call(
            fn,
            on_success=lambda _result: on_success(),
            on_error=lambda error: self._ctx.toast(TOASTS["window_failed"].format(error=describe_error(error))),
            on_done=self._done,
        )

    def _done(self) -> None:
        self._busy = None
        self._render()


def windows_button(popover: WindowsPopover) -> Gtk.MenuButton:
    button = Gtk.MenuButton(child=Icon(WINDOW_ICON, "sm"), popover=popover, css_classes=["flat"], valign=Gtk.Align.CENTER)
    button.set_tooltip_text(ACTIONS["windows"])
    button.update_property([Gtk.AccessibleProperty.LABEL], [ACTIONS["windows"]])
    return button
