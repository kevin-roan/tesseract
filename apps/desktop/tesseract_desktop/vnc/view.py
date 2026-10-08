from collections.abc import Callable, Mapping
from typing import Protocol

import cairo
from gi.repository import Gdk, GLib, Graphene, Gsk, Gtk

from ..widgets.accel_guard import GUARD
from .client import CursorImage
from .framebuffer import Framebuffer, Rect, union
from .input import (
    WHEEL_DOWN,
    WHEEL_LEFT,
    WHEEL_RIGHT,
    WHEEL_UP,
    KeyTracker,
    WheelAccumulator,
    button_bit,
    fit_geometry,
    keysym_for,
    to_framebuffer,
)

SCALE_EPSILON = 1e-3
HIDDEN_CURSOR = "none"
SCROLL_BUTTONS = {
    Gdk.ScrollDirection.UP: WHEEL_UP,
    Gdk.ScrollDirection.DOWN: WHEEL_DOWN,
    Gdk.ScrollDirection.LEFT: WHEEL_LEFT,
    Gdk.ScrollDirection.RIGHT: WHEEL_RIGHT,
}


class InputSink(Protocol):
    def key(self, keysym: int, down: bool) -> None: ...

    def pointer(self, mask: int, x: int, y: int) -> None: ...


class VncView(Gtk.Widget):
    __gtype_name__ = "TesseractVncView"

    def __init__(self, hotkeys: Mapping[int, Callable[[], None]] | None = None) -> None:
        super().__init__(focusable=True, focus_on_click=True, hexpand=True, vexpand=True, overflow=Gtk.Overflow.HIDDEN)
        self.add_css_class("to-vnc-view")
        self._hotkeys = dict(hotkeys or {})
        self._framebuffer: Framebuffer | None = None
        self._texture: Gdk.Texture | None = None
        self._damage: Rect | None = None
        self._fit = True
        self._view_only = False
        self._sink: InputSink | None = None
        self._buttons = 0
        self._position = (0, 0)
        self._keys = KeyTracker()
        self._wheel = WheelAccumulator()
        self._remote_cursor: Gdk.Cursor | None = None
        self._reported_scale: float | None = None
        self._scale_source: int | None = None
        self._guarding = False
        self.on_focus_in: Callable[[], None] | None = None
        self.on_scale_changed: Callable[[float | None], None] | None = None

        legacy = Gtk.EventControllerLegacy()
        legacy.connect("event", self._on_event)
        self.add_controller(legacy)
        keys = Gtk.EventControllerKey()
        keys.connect("key-pressed", self._on_key_pressed)
        keys.connect("key-released", self._on_key_released)
        self.add_controller(keys)
        focus = Gtk.EventControllerFocus()
        focus.connect("enter", lambda *_: self._focus_in())
        focus.connect("leave", lambda *_: self._focus_out())
        self.add_controller(focus)
        self.connect("unrealize", lambda *_: self._guard(False))

    @property
    def fit(self) -> bool:
        return self._fit

    @property
    def view_only(self) -> bool:
        return self._view_only

    @property
    def has_frame(self) -> bool:
        return self._framebuffer is not None and self._framebuffer.width > 0

    @property
    def scale(self) -> float | None:
        fb = self._framebuffer
        if fb is None or not fb.width or not self.get_width():
            return None
        return self._geometry()[0]

    def texture(self) -> Gdk.Texture | None:
        self._refresh_texture()
        return self._texture

    def set_sink(self, sink: InputSink | None) -> None:
        self.release_input()
        self._sink = sink

    def set_fit(self, fit: bool) -> None:
        if fit != self._fit:
            self._fit = fit
            self.queue_resize()

    def set_view_only(self, view_only: bool) -> None:
        if view_only == self._view_only:
            return
        self.release_input()
        self._view_only = view_only
        self._apply_cursor()
        self._guard(self.has_focus() and not view_only)

    def set_framebuffer(self, framebuffer: Framebuffer | None) -> None:
        resized = framebuffer is None or self._texture is None or (
            self._texture.get_width(), self._texture.get_height()
        ) != (framebuffer.width, framebuffer.height)
        self._framebuffer = framebuffer
        if resized:
            self._texture = None
        self._damage = Rect(0, 0, framebuffer.width, framebuffer.height) if framebuffer else None
        self.queue_resize()
        self.queue_draw()

    def invalidate(self, damage: list[Rect]) -> None:
        merged = union(damage + ([self._damage] if self._damage else []))
        if merged is None:
            return
        self._damage = merged
        self.queue_draw()

    def set_remote_cursor(self, cursor: CursorImage | None) -> None:
        if cursor is None:
            self._remote_cursor = None
        elif cursor.empty:
            self._remote_cursor = Gdk.Cursor.new_from_name(HIDDEN_CURSOR, None)
        else:
            texture = Gdk.MemoryTexture.new(
                cursor.width, cursor.height, Gdk.MemoryFormat.B8G8R8A8, GLib.Bytes.new(cursor.pixels), cursor.width * 4
            )
            self._remote_cursor = Gdk.Cursor.new_from_texture(texture, cursor.hot_x, cursor.hot_y, None)
        self._apply_cursor()

    def release_input(self) -> None:
        keysyms = self._keys.release_all()
        buttons, self._buttons = self._buttons, 0
        self._wheel.reset()
        if self._sink is None:
            return
        for keysym in keysyms:
            self._sink.key(keysym, False)
        if buttons:
            self._sink.pointer(0, *self._position)

    def _apply_cursor(self) -> None:
        self.set_cursor(None if self._view_only else self._remote_cursor)

    def _focus_in(self) -> None:
        self._guard(not self._view_only)
        if self.on_focus_in:
            self.on_focus_in()

    def _focus_out(self) -> None:
        self._guard(False)
        self.release_input()

    def _guard(self, active: bool) -> None:
        if active == self._guarding:
            return
        if active:
            root = self.get_root()
            self._guarding = GUARD.acquire(root.get_application() if isinstance(root, Gtk.Window) else None)
        else:
            self._guarding = False
            GUARD.release()

    def _refresh_texture(self) -> None:
        fb = self._framebuffer
        if fb is None or not fb.width or not fb.height:
            return
        if self._texture is not None and self._damage is None:
            return
        builder = Gdk.MemoryTextureBuilder()
        builder.set_bytes(GLib.Bytes.new(fb.data))
        builder.set_width(fb.width)
        builder.set_height(fb.height)
        builder.set_stride(fb.stride)
        builder.set_format(Gdk.MemoryFormat.B8G8R8X8)
        if self._texture is not None and self._damage is not None:
            damage = self._damage
            builder.set_update_texture(self._texture)
            builder.set_update_region(cairo.Region(cairo.RectangleInt(damage.x, damage.y, damage.width, damage.height)))
        self._texture = builder.build()
        self._damage = None

    def _geometry(self) -> tuple[float, float, float]:
        fb = self._framebuffer
        if fb is None:
            return 1.0, 0.0, 0.0
        return fit_geometry(fb.width, fb.height, self.get_width(), self.get_height(), self._fit)

    def do_measure(self, orientation: Gtk.Orientation, for_size: int) -> tuple[int, int, int, int]:
        fb = self._framebuffer
        if self._fit or fb is None:
            return 0, 0, -1, -1
        size = fb.width if orientation == Gtk.Orientation.HORIZONTAL else fb.height
        return size, size, -1, -1

    def do_size_allocate(self, width: int, height: int, baseline: int) -> None:
        if self._scale_source is None and self.scale != self._reported_scale:
            self._scale_source = GLib.idle_add(self._report_scale)

    def _report_scale(self) -> bool:
        self._scale_source = None
        self._reported_scale = self.scale
        if self.on_scale_changed:
            self.on_scale_changed(self._reported_scale)
        return GLib.SOURCE_REMOVE

    def do_snapshot(self, snapshot: Gtk.Snapshot) -> None:
        self._refresh_texture()
        fb = self._framebuffer
        if self._texture is None or fb is None:
            return
        scale, offset_x, offset_y = self._geometry()
        bounds = Graphene.Rect().init(offset_x, offset_y, fb.width * scale, fb.height * scale)
        if abs(scale - 1.0) < SCALE_EPSILON:
            scaling = Gsk.ScalingFilter.NEAREST
        else:
            scaling = Gsk.ScalingFilter.TRILINEAR if scale < 1 else Gsk.ScalingFilter.LINEAR
        snapshot.append_scaled_texture(self._texture, scaling, bounds)

    def _widget_point(self, event: Gdk.Event) -> tuple[float, float] | None:
        found, x, y = event.get_position()
        native = self.get_native()
        if not found or native is None:
            return None
        surface_x, surface_y = native.get_surface_transform()
        ok, point = native.compute_point(self, Graphene.Point().init(x - surface_x, y - surface_y))
        return (point.x, point.y) if ok else None

    def _send_pointer(self, event: Gdk.Event) -> bool:
        fb = self._framebuffer
        if fb is None or self._sink is None:
            return False
        point = self._widget_point(event)
        if point is None:
            return False
        self._position = to_framebuffer(point[0], point[1], self._geometry(), fb.width, fb.height)
        self._sink.pointer(self._buttons, *self._position)
        return True

    def _click_wheel(self, buttons: list[int]) -> None:
        if self._sink is None:
            return
        for button in buttons:
            self._sink.pointer(self._buttons | button_bit(button), *self._position)
            self._sink.pointer(self._buttons, *self._position)

    def _on_event(self, _controller: Gtk.EventControllerLegacy, event: Gdk.Event) -> bool:
        if self._view_only or self._sink is None or self._framebuffer is None:
            return False
        kind = event.get_event_type()
        if kind == Gdk.EventType.MOTION_NOTIFY:
            self._send_pointer(event)
            return False
        if kind in (Gdk.EventType.BUTTON_PRESS, Gdk.EventType.BUTTON_RELEASE):
            bit = button_bit(event.get_button())
            if kind == Gdk.EventType.BUTTON_PRESS:
                self.grab_focus()
                self._buttons |= bit
            else:
                self._buttons &= ~bit
            return self._send_pointer(event)
        if kind == Gdk.EventType.SCROLL:
            self._send_pointer(event)
            direction = event.get_direction()
            if direction == Gdk.ScrollDirection.SMOOTH:
                dx, dy = event.get_deltas()
                self._click_wheel(self._wheel.clicks(dx, dy))
            elif direction in SCROLL_BUTTONS:
                self._click_wheel([SCROLL_BUTTONS[direction]])
            return True
        return False

    def _on_key_pressed(self, _controller: Gtk.EventControllerKey, keyval: int, keycode: int, _state: Gdk.ModifierType) -> bool:
        hotkey = self._hotkeys.get(keyval)
        if hotkey is not None:
            hotkey()
            return True
        if self._view_only or self._sink is None:
            return False
        self._sink.key(self._keys.press(keycode, keysym_for(keyval)), True)
        return True

    def _on_key_released(self, _controller: Gtk.EventControllerKey, keyval: int, keycode: int, _state: Gdk.ModifierType) -> None:
        if self._view_only or self._sink is None:
            return
        keysym = self._keys.release(keycode)
        if keysym is not None:
            self._sink.key(keysym, False)
