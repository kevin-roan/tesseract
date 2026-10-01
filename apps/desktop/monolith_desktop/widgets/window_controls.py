import math

import cairo
from gi.repository import Gtk

from ..strings import WINDOW_CONTROLS
from ..theme.tokens import WINDOW_CONTROL
from .drawing import rounded_rect, set_source

CONTROL_ORDER = ("minimize", "maximize", "close")


def decoration_buttons(layout: str | None) -> tuple[str, ...]:
    requested = {part.strip() for side in (layout or "").split(":") for part in side.split(",")}
    return tuple(name for name in CONTROL_ORDER if name in requested or name == "close")


def _draw_glyph(kind: str, cr, width: int, height: int) -> None:
    size = WINDOW_CONTROL["glyph"]
    x = math.floor((width - size) / 2) + 0.5
    y = math.floor((height - size) / 2) + 0.5
    span = size - 1
    cr.set_line_width(WINDOW_CONTROL["stroke"])
    cr.set_line_cap(cairo.LINE_CAP_ROUND)
    if kind == "minimize":
        cr.move_to(x, y + span / 2 + 0.5)
        cr.line_to(x + span, y + span / 2 + 0.5)
    elif kind == "maximize":
        rounded_rect(cr, x, y, span, span, WINDOW_CONTROL["corner"])
    elif kind == "restore":
        offset = WINDOW_CONTROL["restore_offset"]
        rounded_rect(cr, x, y + offset, span - offset, span - offset, WINDOW_CONTROL["corner"])
        cr.move_to(x + offset, y + offset - 0.5)
        cr.line_to(x + offset, y)
        cr.line_to(x + span, y)
        cr.line_to(x + span, y + span - offset)
        cr.line_to(x + span - offset + 0.5, y + span - offset)
    else:
        cr.move_to(x, y)
        cr.line_to(x + span, y + span)
        cr.move_to(x + span, y)
        cr.line_to(x, y + span)
    cr.stroke()


class WindowGlyph(Gtk.DrawingArea):
    def __init__(self, kind: str) -> None:
        box = WINDOW_CONTROL["glyph"] + 4
        super().__init__(content_width=box, content_height=box, can_target=False)
        self._kind = kind
        self.set_draw_func(self._draw)

    def set_kind(self, kind: str) -> None:
        if kind != self._kind:
            self._kind = kind
            self.queue_draw()

    def _draw(self, _area, cr, width: int, height: int) -> None:
        set_source(cr, self.get_color())
        _draw_glyph(self._kind, cr, width, height)


class WindowControlButton(Gtk.Button):
    def __init__(self, kind: str) -> None:
        super().__init__(css_classes=["to-window-control", kind], valign=Gtk.Align.CENTER, focus_on_click=False)
        self.kind = kind
        self.glyph = WindowGlyph(kind)
        self.set_child(self.glyph)
        self.set_tooltip_text(WINDOW_CONTROLS[kind])
        self.update_property([Gtk.AccessibleProperty.LABEL], [WINDOW_CONTROLS[kind]])

    def show_state(self, maximized: bool) -> None:
        if self.kind != "maximize":
            return
        label = WINDOW_CONTROLS["restore" if maximized else "maximize"]
        self.glyph.set_kind("restore" if maximized else "maximize")
        self.set_tooltip_text(label)
        self.update_property([Gtk.AccessibleProperty.LABEL], [label])


class WindowControls(Gtk.Box):
    def __init__(self) -> None:
        super().__init__(spacing=WINDOW_CONTROL["spacing"], valign=Gtk.Align.CENTER, css_classes=["to-window-controls"])
        self._buttons: dict[str, WindowControlButton] = {}
        for kind in CONTROL_ORDER:
            button = WindowControlButton(kind)
            button.connect("clicked", lambda _button, k=kind: self._activate(k))
            self._buttons[kind] = button
            self.append(button)
        self._window: Gtk.Window | None = None
        self._handlers: list[tuple[object, int]] = []
        self.connect("realize", lambda *_: self._attach())
        self.connect("unrealize", lambda *_: self._detach())

    def _attach(self) -> None:
        self._detach()
        root = self.get_root()
        settings = Gtk.Settings.get_for_display(self.get_display())
        self._handlers.append((settings, settings.connect("notify::gtk-decoration-layout", lambda *_: self._sync_layout())))
        if isinstance(root, Gtk.Window):
            self._window = root
            self._handlers.append((root, root.connect("notify::maximized", lambda *_: self._sync_state())))
        self._sync_layout()
        self._sync_state()

    def _detach(self) -> None:
        for source, handler in self._handlers:
            source.disconnect(handler)
        self._handlers.clear()
        self._window = None

    def _sync_layout(self) -> None:
        layout = Gtk.Settings.get_for_display(self.get_display()).get_property("gtk-decoration-layout")
        shown = decoration_buttons(layout)
        for kind, button in self._buttons.items():
            button.set_visible(kind in shown)

    def _sync_state(self) -> None:
        maximized = bool(self._window and self._window.is_maximized())
        self._buttons["maximize"].show_state(maximized)

    def _activate(self, kind: str) -> None:
        window = self._window or self.get_root()
        if not isinstance(window, Gtk.Window):
            return
        if kind == "minimize":
            window.minimize()
        elif kind == "maximize":
            window.unmaximize() if window.is_maximized() else window.maximize()
        else:
            window.close()
