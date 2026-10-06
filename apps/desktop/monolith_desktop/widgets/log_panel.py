from collections.abc import Callable

from gi.repository import Gtk

from ..theme.tone import Tone
from .badges import StatusBadge
from .buttons import ActionButton, IconButton
from .icon import Icon
from .log_view import LogView
from .text import Text

PANEL_LOG_HEIGHT = 320


class LogPanel(Gtk.Box):
    def __init__(
        self,
        close_label: str,
        on_close: Callable[[], None] | None = None,
        empty_label: str = "No output yet.",
        jump_label: str = "Jump to latest output",
        min_height: int = PANEL_LOG_HEIGHT,
    ) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=6, css_classes=["to-log-panel"])
        header = Gtk.Box(spacing=8, css_classes=["to-log-panel-header"])
        header.append(Icon("terminal", "xs", "textTertiary"))
        self._title = Text("", "label")
        self._title.set_hexpand(True)
        self._status = StatusBadge("")
        self._status.set_visible(False)
        self._action = ActionButton("", self._activate_action, "secondary")
        self._action.set_visible(False)
        self._on_action: Callable[[], None] | None = None
        header.append(self._title)
        header.append(self._action)
        header.append(self._status)
        if on_close:
            close = IconButton("close", close_label, on_close)
            close.add_css_class("to-row-action")
            header.append(close)
        self.append(header)
        self._notice = Text("", "caption", "textTertiary", wrap=True, lines=None)
        self._notice.set_visible(False)
        self.append(self._notice)
        self.view = LogView(empty_label, jump_label, min_height=min_height)
        self.view.set_size_request(-1, min_height)
        self.append(self.view)

    def set_title(self, title: str) -> None:
        self._title.set_label(title)

    def set_status(self, label: str | None, tone: Tone = "neutral", live: bool = False) -> None:
        self._status.set_visible(bool(label))
        if label:
            self._status.update(label, tone, live)

    def set_action(
        self, label: str | None, icon: str | None = None, on_activate: Callable[[], None] | None = None, sensitive: bool = True,
    ) -> None:
        """A header button next to the status badge; a None label hides it."""
        self._on_action = on_activate
        self._action.set_visible(bool(label))
        if label:
            self._action.set_label_text(label)
            if icon:
                self._action.set_icon(icon)
            self._action.set_sensitive(sensitive)

    def _activate_action(self) -> None:
        if self._on_action:
            self._on_action()

    def set_notice(self, message: str | None) -> None:
        self._notice.set_text_value(message)
