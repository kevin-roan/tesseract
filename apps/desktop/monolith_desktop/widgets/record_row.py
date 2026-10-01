from collections.abc import Callable
from dataclasses import dataclass

from gi.repository import Gtk

from ..theme.tone import Tone
from .badges import StatusBadge
from .buttons import ActionButton, IconButton
from .icon import IconBadge
from .progress import ProgressBar
from .text import Text
from .tone import ToneBinding


@dataclass(frozen=True)
class RowAction:
    id: str
    icon: str
    label: str
    on_activate: Callable[[], None]
    sensitive: bool = True
    destructive: bool = False
    active: bool = False
    labeled: bool = False


class RecordRow(Gtk.Box):
    def __init__(self, icon: str | None = None, monospace_title: bool = False, monospace_subtitle: bool = False) -> None:
        super().__init__(spacing=12, css_classes=["to-record-row"])
        self._on_activate: Callable[[], None] | None = None
        self._badge = IconBadge(icon or "info", "sm")
        self._badge.set_valign(Gtk.Align.CENTER)
        self._badge.set_hexpand(False)
        self._badge.set_visible(icon is not None)
        self._code = Text("", "code", xalign=0.5)
        self._code.add_css_class("to-record-code")
        self._code.add_css_class("to-tone-bg")
        self._code.add_css_class("to-tone-fg")
        self._code.set_valign(Gtk.Align.CENTER)
        self._code.set_visible(False)
        self._code_tone = ToneBinding("neutral", self._code)
        body = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, hexpand=True, valign=Gtk.Align.CENTER)
        self._title = Text("", "code" if monospace_title else "label")
        self._subtitle = Text("", "code" if monospace_subtitle else "bodySmall", "textSecondary")
        self._meta = Text("", "caption", "textTertiary")
        self._progress = ProgressBar(None, "info")
        self._progress.set_visible(False)
        self._progress.set_margin_top(6)
        for widget in (self._title, self._subtitle, self._meta, self._progress):
            body.append(widget)
        self._status = StatusBadge("")
        self._status.set_visible(False)
        self._status.set_valign(Gtk.Align.CENTER)
        self._actions = Gtk.Box(spacing=2, valign=Gtk.Align.CENTER)
        self._action_ids: list[str] = []
        self._handlers: list[tuple[Gtk.Button, int]] = []
        for widget in (self._badge, self._code, body, self._status, self._actions):
            self.append(widget)

    def set_icon(self, icon: str | None) -> None:
        self._badge.set_visible(icon is not None)
        if icon:
            self._badge.set_icon(icon)

    def set_code(self, code: str | None, tone: Tone = "neutral") -> None:
        self._code.set_text_value(code)
        self._code_tone.set(tone)

    def set_content(self, title: str, subtitle: str | None = None, meta: str | None = None) -> None:
        self._title.set_label(title)
        self._title.set_tooltip_text(title if len(title) > 48 else None)
        self._subtitle.set_text_value(subtitle)
        self._meta.set_text_value(meta)

    def set_status(self, label: str | None, tone: Tone = "neutral") -> None:
        self._status.set_visible(bool(label))
        if label:
            self._status.update(label, tone)

    def set_progress(self, progress: float | None, visible: bool | None = None) -> None:
        self._progress.set_visible(progress is not None if visible is None else visible)
        self._progress.set_progress(progress)

    def set_actions(self, actions: list[RowAction]) -> None:
        ids = [f"{a.id}:{a.icon}:{a.sensitive}:{a.active}:{a.labeled}:{a.label if a.labeled else ''}" for a in actions]
        if ids == self._action_ids:
            self._rebind(actions)
            return
        self._action_ids = ids
        while (child := self._actions.get_first_child()) is not None:
            self._actions.remove(child)
        self._handlers = []
        for action in actions:
            button = ActionButton(action.label, None, "secondary", action.icon) if action.labeled else IconButton(action.icon, action.label)
            button.set_sensitive(action.sensitive)
            if action.destructive:
                button.add_css_class("to-danger-button")
            if action.active:
                button.add_css_class("to-active-button")
            self._handlers.append((button, button.connect("clicked", lambda *_, cb=action.on_activate: cb())))
            self._actions.append(button)

    def _rebind(self, actions: list[RowAction]) -> None:
        rebound = []
        for (button, handler), action in zip(self._handlers, actions):
            button.disconnect(handler)
            rebound.append((button, button.connect("clicked", lambda *_, cb=action.on_activate: cb())))
            if not action.labeled:
                button.set_tooltip_text(action.label)
        self._handlers = rebound

    def set_on_activate(self, callback: Callable[[], None] | None) -> None:
        self._on_activate = callback

    @property
    def activatable(self) -> bool:
        return self._on_activate is not None

    def activate_row(self) -> None:
        if self._on_activate:
            self._on_activate()
