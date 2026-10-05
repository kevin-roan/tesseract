from collections.abc import Callable
from dataclasses import dataclass

from gi.repository import Gtk

from ..theme.tone import TONE_COLORS, Tone
from .badges import StatusBadge
from .buttons import ActionButton, IconButton
from .icon import Icon
from .list_view import HoverRow
from .progress import ProgressBar
from .text import Text
from .tone import ToneBinding

TITLE_CHARS = 56
STATUS_GLYPHS: dict[Tone, str] = {
    "neutral": "status-todo",
    "info": "status-progress",
    "success": "status-done",
    "warning": "status-progress",
    "danger": "status-canceled",
}


def status_glyph(tone: Tone) -> tuple[str, str]:
    """The Linear status circle and its color for a tone."""
    return STATUS_GLYPHS[tone], TONE_COLORS[tone].foreground if tone != "neutral" else "textTertiary"


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


class RecordRow(HoverRow):
    """A single-line Linear list row: glyph, code, title, tertiary detail, right-aligned meta and actions.

    Icon-only actions float in on hover; rows with a labeled action keep all of them visible.
    """

    def __init__(self, icon: str | None = None, monospace_title: bool = False, monospace_subtitle: bool = False) -> None:
        self._row = Gtk.Box(spacing=10, css_classes=["to-record-row"])
        super().__init__(self._row)
        self._on_activate: Callable[[], None] | None = None
        self._icon_name = icon
        self._icon = Icon(icon or "info", "sm", "textSecondary")
        self._icon.set_valign(Gtk.Align.CENTER)
        self._icon.set_visible(icon is not None)
        self._code = Text("", "code", xalign=0.5)
        self._code.add_css_class("to-record-code")
        self._code.add_css_class("to-tone-fg")
        self._code.set_valign(Gtk.Align.CENTER)
        self._code.set_visible(False)
        self._code_tone = ToneBinding("neutral", self._code)
        body = Gtk.Box(spacing=10, hexpand=True, valign=Gtk.Align.CENTER)
        self._title = Text("", "code" if monospace_title else "label")
        self._title.add_css_class("to-record-title")
        self._subtitle = Text("", "code" if monospace_subtitle else "body", "textTertiary")
        self._subtitle.set_hexpand(True)
        self._subtitle.set_max_width_chars(1)
        body.append(self._title)
        body.append(self._subtitle)
        self._progress = ProgressBar(None, "info")
        self._progress.set_visible(False)
        self._progress.set_valign(Gtk.Align.CENTER)
        self._progress.set_hexpand(False)
        self._progress.add_css_class("to-record-progress")
        self._meta = Text("", "caption", "textTertiary", xalign=1.0)
        self._meta.set_max_width_chars(48)
        self._meta.set_valign(Gtk.Align.CENTER)
        self._status = StatusBadge("")
        self._status.set_visible(False)
        self._status.set_valign(Gtk.Align.CENTER)
        self._actions = Gtk.Box(spacing=2, valign=Gtk.Align.CENTER, css_classes=["to-row-actions"])
        self._action_ids: list[str] = []
        self._handlers: list[tuple[Gtk.Button, int]] = []
        for widget in (self._icon, self._code, body, self._progress, self._meta, self._status, self._actions):
            self._row.append(widget)

    def set_icon(self, icon: str | None, color: str = "textSecondary") -> None:
        self._icon_name = icon
        self._icon.set_visible(icon is not None)
        if icon:
            self._icon.set_icon(icon)
            self._icon.set_color(color)

    def set_code(self, code: str | None, tone: Tone = "neutral") -> None:
        self._code.set_text_value(code)
        self._code_tone.set(tone)

    def set_content(self, title: str, subtitle: str | None = None, meta: str | None = None) -> None:
        self._title.set_label(title)
        self._title.set_tooltip_text(title if len(title) > 48 else None)
        self._subtitle.set_text_value(subtitle)
        self._subtitle.set_tooltip_text(subtitle if subtitle and len(subtitle) > 48 else None)
        self._meta.set_text_value(meta)
        self._meta.set_tooltip_text(meta if meta and len(meta) > 48 else None)
        self._title.set_hexpand(not subtitle)
        self._title.set_max_width_chars(TITLE_CHARS if subtitle else 1)

    def set_status(self, label: str | None, tone: Tone = "neutral", glyph: bool = False) -> None:
        """Show the status as a hairline pill, or (`glyph`) as Linear's colored status circle in front of the title."""
        if glyph:
            self._status.set_visible(False)
            icon, color = status_glyph(tone)
            self.set_icon(icon, color)
            self._icon.set_tooltip_text(label)
            return
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
        for box in (self._actions, self.hover_actions):
            while (child := box.get_first_child()) is not None:
                box.remove(child)
        self._handlers = []
        target = self._actions if any(a.labeled for a in actions) else self.hover_actions
        for action in actions:
            button = ActionButton(action.label, None, "secondary", action.icon) if action.labeled else IconButton(action.icon, action.label)
            button.set_sensitive(action.sensitive)
            button.add_css_class("to-row-action")
            if action.labeled:
                button.add_css_class("labeled")
            if action.destructive:
                button.add_css_class("to-danger-button")
            if action.active:
                button.add_css_class("to-active-button")
            self._handlers.append((button, button.connect("clicked", lambda *_, cb=action.on_activate: cb())))
            target.append(button)
        self.sync_hover_actions()

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
