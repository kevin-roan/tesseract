import math
import time
from collections.abc import Callable

from gi.repository import Gdk, Gio, GLib, Gtk, Pango

from ...theme.manager import theme
from ...theme.typography import MONO_STACK
from ..accel_guard import GUARD
from .cells import WIDE_TAIL
from .config import (
    BLINK_INTERVAL_MS,
    DEFAULT_GRID,
    FEED_BUDGET_S,
    FEED_SLICE,
    FONT_SIZE_MAX_PX,
    FONT_SIZE_MIN_PX,
    FONT_SIZE_PX,
    PADDING_PX,
    RESIZE_DEBOUNCE_MS,
    SELECTION_AUTOSCROLL_MS,
    SYNC_TIMEOUT_MS,
    WHEEL_LINES,
)
from .keys import (
    FOCUS_IN,
    FOCUS_OUT,
    NO_BUTTON,
    WHEEL_DOWN,
    WHEEL_UP,
    Modifiers,
    encode_key,
    encode_mouse,
    encode_paste,
)
from .labels import MENU
from .palette import palette_for
from .renderer import Renderer
from .selection import Selection, row_span, selected_text, selection_range
from .terminal import MOUSE_ANY, MOUSE_BUTTON, MOUSE_X10, Terminal

SCROLL_KEYS = frozenset(("Page_Up", "Page_Down", "KP_Page_Up", "KP_Page_Down", "Prior", "Next"))
ZOOM_IN_KEYS = frozenset(("equal", "plus", "KP_Add"))
ZOOM_OUT_KEYS = frozenset(("minus", "KP_Subtract"))
PAGE_UP_KEYS = frozenset(("Page_Up", "KP_Page_Up", "Prior"))
ZOOM_RESET_KEYS = frozenset(("0", "KP_0"))
BUTTONS = {Gdk.BUTTON_PRIMARY: 0, Gdk.BUTTON_MIDDLE: 1, Gdk.BUTTON_SECONDARY: 2}


def font_description(size_px: int) -> Pango.FontDescription:
    description = Pango.FontDescription()
    description.set_family(",".join(MONO_STACK))
    description.set_absolute_size(size_px * Pango.SCALE)
    return description


def grid_for(width: float, height: float, cell_width: float, cell_height: float) -> tuple[int, int]:
    cols = max(2, int((width - 2 * PADDING_PX) / cell_width))
    rows = max(1, int((height - 2 * PADDING_PX) / cell_height))
    return cols, rows


def estimate_grid(widget: Gtk.Widget, size_px: int = FONT_SIZE_PX) -> tuple[int, int]:
    width, height = widget.get_width(), widget.get_height()
    if width <= 0 or height <= 0:
        return DEFAULT_GRID
    metrics = Renderer().set_font(widget.get_pango_context(), font_description(size_px))
    return grid_for(width, height, metrics.cell_width, metrics.cell_height)


def _modifiers(state: Gdk.ModifierType) -> Modifiers:
    return Modifiers(
        bool(state & Gdk.ModifierType.SHIFT_MASK),
        bool(state & Gdk.ModifierType.CONTROL_MASK),
        bool(state & Gdk.ModifierType.ALT_MASK),
    )


class TerminalView(Gtk.Box):
    def __init__(
        self,
        on_input: Callable[[str], None] | None = None,
        on_resize: Callable[[int, int], None] | None = None,
        on_title: Callable[[str], None] | None = None,
        scrollback: int | None = None,
    ) -> None:
        super().__init__(css_classes=["to-terminal"], hexpand=True, vexpand=True)
        self.on_input = on_input
        self.on_resize = on_resize
        self.on_title = on_title
        self.input_enabled = True
        cols, rows = DEFAULT_GRID
        kwargs = {"scrollback": scrollback} if scrollback is not None else {}
        self.terminal = Terminal(cols, rows, on_reply=self._reply, on_title=self._title_changed, **kwargs)
        self._renderer = Renderer()
        self._font_px = FONT_SIZE_PX
        self._offset = 0
        self._pushed = 0
        self._pending: list[str] = []
        self._feed_source: int | None = None
        self._resize_source: int | None = None
        self._blink_source: int | None = None
        self._sync_source: int | None = None
        self._autoscroll_source: int | None = None
        self._cursor_on = True
        self._focused = False
        self._grid_known = False
        self._selection: Selection | None = None
        self._drag_origin = (0.0, 0.0)
        self._drag_button = 0
        self._drag_mods = Modifiers()
        self._drag_point = (0.0, 0.0)
        self._reporting = False
        self._selecting = False
        self._last_click = (0.0, 0.0, 0.0, 0)
        self._last_report_cell: tuple[int, int] | None = None
        self._scroll_accumulator = 0.0
        self._updating_adjustment = False
        self._pointer = (0.0, 0.0)
        self._pointer_cursor = "text"
        self._released = False
        self._guarding = False

        self._canvas = Gtk.DrawingArea(hexpand=True, vexpand=True, focusable=True, can_focus=True)
        self._canvas.add_css_class("to-terminal-canvas")
        self._canvas.set_cursor_from_name("text")
        self._canvas.set_draw_func(self._draw)
        self._canvas.connect("resize", self._on_canvas_resize)
        self._adjustment = Gtk.Adjustment(lower=0, upper=rows, page_size=rows, step_increment=1, page_increment=rows)
        self._adjustment.connect("value-changed", self._on_adjustment)
        self._scrollbar = Gtk.Scrollbar(
            orientation=Gtk.Orientation.VERTICAL, adjustment=self._adjustment, halign=Gtk.Align.END, visible=False
        )
        self._scrollbar.add_css_class("to-terminal-scrollbar")
        overlay = Gtk.Overlay(child=self._canvas, hexpand=True, vexpand=True)
        overlay.add_overlay(self._scrollbar)
        self.append(overlay)

        self._im = Gtk.IMMulticontext()
        self._im.set_client_widget(self._canvas)
        self._im.set_use_preedit(False)
        self._im.connect("commit", lambda _im, text: self._user_input(text))
        self._install_controllers()
        self._install_menu()

        self._unsubscribe_theme = theme().subscribe(lambda _scheme: self._apply_palette())
        self._apply_palette()
        self._apply_font()
        self.connect("destroy", lambda *_: self.release())

    @property
    def grid(self) -> tuple[int, int]:
        return self.terminal.cols, self.terminal.rows

    @property
    def grid_known(self) -> bool:
        return self._grid_known

    def feed(self, data: str) -> None:
        if not data:
            return
        self._pending.append(data)
        if self._feed_source is None:
            self._feed_source = GLib.idle_add(self._process_pending, priority=GLib.PRIORITY_DEFAULT_IDLE)

    def reset(self) -> None:
        self._pending.clear()
        self.terminal.reset()
        self._pushed = self.terminal.primary.pushed
        self._offset = 0
        self._selection = None
        self._queue_redraw()

    def set_input_enabled(self, enabled: bool) -> None:
        self.input_enabled = enabled
        self._queue_redraw()

    def focus(self) -> None:
        self._canvas.grab_focus()

    def copy(self) -> None:
        text = self._selected_text()
        if text:
            self.get_clipboard().set(text)

    def paste(self) -> None:
        self.get_clipboard().read_text_async(None, self._on_paste_ready)

    def select_all(self) -> None:
        buffer = self.terminal.buffer
        self._selection = Selection((buffer.first_index, 0), (buffer.end_index - 1, self.terminal.cols), "char")
        self._queue_redraw()

    def clear(self) -> None:
        self.terminal.clear_to_cursor_line()
        self._offset = 0
        self._selection = None
        self._queue_redraw()

    def zoom(self, step: int) -> None:
        size = FONT_SIZE_PX if step == 0 else self._font_px + step
        size = max(FONT_SIZE_MIN_PX, min(FONT_SIZE_MAX_PX, size))
        if size != self._font_px:
            self._font_px = size
            self._apply_font()

    def scroll_lines(self, lines: int) -> None:
        self._set_offset(self._offset + lines)

    def scroll_to_bottom(self) -> None:
        self._set_offset(0)

    def release(self) -> None:
        if self._released:
            return
        self._released = True
        self.on_input = None
        self.on_resize = None
        self.on_title = None
        self._unsubscribe_theme()
        self._guard(False)
        for name in ("_feed_source", "_resize_source", "_blink_source", "_sync_source", "_autoscroll_source"):
            source = getattr(self, name)
            if source is not None:
                GLib.source_remove(source)
                setattr(self, name, None)
        self._pending.clear()
        self._im.set_client_widget(None)
        if self._menu.get_parent() is not None:
            self._menu.unparent()

    def _install_controllers(self) -> None:
        keys = Gtk.EventControllerKey()
        keys.connect("key-pressed", self._on_key_pressed)
        keys.connect("key-released", self._on_key_released)
        self._canvas.add_controller(keys)

        focus = Gtk.EventControllerFocus()
        focus.connect("enter", lambda *_: self._set_focused(True))
        focus.connect("leave", lambda *_: self._set_focused(False))
        self._canvas.add_controller(focus)

        drag = Gtk.GestureDrag(button=0)
        drag.connect("drag-begin", self._on_drag_begin)
        drag.connect("drag-update", self._on_drag_update)
        drag.connect("drag-end", self._on_drag_end)
        self._canvas.add_controller(drag)
        self._drag = drag

        motion = Gtk.EventControllerMotion()
        motion.connect("motion", self._on_motion)
        self._canvas.add_controller(motion)

        scroll = Gtk.EventControllerScroll(flags=Gtk.EventControllerScrollFlags.VERTICAL)
        scroll.connect("scroll", self._on_scroll)
        scroll.connect("scroll-begin", lambda *_: setattr(self, "_scroll_accumulator", 0.0))
        self._canvas.add_controller(scroll)

    def _install_menu(self) -> None:
        group = Gio.SimpleActionGroup()
        for name, handler in (("copy", self.copy), ("paste", self.paste), ("select-all", self.select_all), ("clear", self.clear)):
            action = Gio.SimpleAction.new(name, None)
            action.connect("activate", lambda _a, _p, fn=handler: fn())
            group.add_action(action)
        self._actions = group
        self.insert_action_group("term", group)
        model = Gio.Menu()
        edit = Gio.Menu()
        edit.append(MENU["copy"], "term.copy")
        edit.append(MENU["paste"], "term.paste")
        edit.append(MENU["select-all"], "term.select-all")
        model.append_section(None, edit)
        tools = Gio.Menu()
        tools.append(MENU["clear"], "term.clear")
        model.append_section(None, tools)
        self._menu = Gtk.PopoverMenu.new_from_model(model)
        self._menu.set_has_arrow(False)
        self._menu.set_halign(Gtk.Align.START)
        self._menu.set_parent(self._canvas)

    def _apply_palette(self) -> None:
        self.terminal.palette = palette_for(theme().scheme)
        self._queue_redraw()

    def _apply_font(self) -> None:
        metrics = self._renderer.set_font(self._canvas.get_pango_context(), font_description(self._font_px))
        self.terminal.cell_pixels = (max(1, round(metrics.cell_width)), metrics.cell_height)
        self._fit(self._canvas.get_width(), self._canvas.get_height())
        self._queue_redraw()

    def _on_canvas_resize(self, _area: Gtk.DrawingArea, width: int, height: int) -> None:
        self._fit(width, height)

    def _fit(self, width: int, height: int) -> None:
        if width <= 0 or height <= 0:
            return
        metrics = self._renderer.metrics
        cols, rows = grid_for(width, height, metrics.cell_width, metrics.cell_height)
        self._grid_known = True
        if (cols, rows) == self.grid:
            return
        self.terminal.resize(cols, rows)
        self._pushed = self.terminal.primary.pushed
        self._offset = min(self._offset, self.terminal.buffer.history)
        self._selection = None
        if self._resize_source is not None:
            GLib.source_remove(self._resize_source)
        self._resize_source = GLib.timeout_add(RESIZE_DEBOUNCE_MS, self._emit_resize)
        self._queue_redraw()

    def _emit_resize(self) -> bool:
        self._resize_source = None
        if self.on_resize:
            self.on_resize(*self.grid)
        return GLib.SOURCE_REMOVE

    def _process_pending(self) -> bool:
        deadline = time.monotonic() + FEED_BUDGET_S
        terminal = self.terminal
        while self._pending and time.monotonic() < deadline:
            chunk = self._pending[0]
            if len(chunk) > FEED_SLICE:
                self._pending[0] = chunk[FEED_SLICE:]
                chunk = chunk[:FEED_SLICE]
            else:
                self._pending.pop(0)
            terminal.feed(chunk)
        pushed = terminal.primary.pushed
        if self._offset and not terminal.alt_screen:
            self._offset = min(terminal.buffer.history, self._offset + pushed - self._pushed)
        self._pushed = pushed
        self._cursor_on = True
        self._queue_redraw()
        if self._pending:
            return GLib.SOURCE_CONTINUE
        self._feed_source = None
        return GLib.SOURCE_REMOVE

    def _queue_redraw(self) -> None:
        if self.terminal.synchronized:
            if self._sync_source is None:
                self._sync_source = GLib.timeout_add(SYNC_TIMEOUT_MS, self._sync_expired)
            return
        self._clear_sync()
        self._sync_adjustment()
        self._update_blink()
        self._canvas.queue_draw()

    def _sync_expired(self) -> bool:
        self._sync_source = None
        self._sync_adjustment()
        self._canvas.queue_draw()
        return GLib.SOURCE_REMOVE

    def _clear_sync(self) -> None:
        if self._sync_source is not None:
            GLib.source_remove(self._sync_source)
            self._sync_source = None

    def _sync_adjustment(self) -> None:
        history = self.terminal.buffer.history
        rows = self.terminal.rows
        self._offset = max(0, min(self._offset, history))
        self._updating_adjustment = True
        self._adjustment.configure(history - self._offset, 0, history + rows, 1, rows, rows)
        self._updating_adjustment = False
        self._scrollbar.set_visible(history > 0)

    def _on_adjustment(self, adjustment: Gtk.Adjustment) -> None:
        if self._updating_adjustment:
            return
        history = self.terminal.buffer.history
        offset = history - round(adjustment.get_value())
        if offset != self._offset:
            self._offset = max(0, min(history, offset))
            self._canvas.queue_draw()

    def _set_offset(self, offset: int) -> None:
        offset = max(0, min(self.terminal.buffer.history, offset))
        if offset != self._offset:
            self._offset = offset
            self._queue_redraw()

    def _draw(self, _area: Gtk.DrawingArea, cr, width: int, height: int) -> None:
        terminal = self.terminal
        renderer = self._renderer
        renderer.set_palette(terminal.palette, terminal.reverse_video)
        metrics = renderer.metrics
        _fg, bg = renderer.defaults()
        cr.set_source_rgb(bg[0] / 255, bg[1] / 255, bg[2] / 255)
        cr.paint()
        buffer = terminal.buffer
        offset = min(self._offset, buffer.history)
        lines = buffer.visible(offset)
        first = buffer.screen_index(0) - offset
        bounds = self._selection_bounds()
        cols = terminal.cols
        for row, line in enumerate(lines):
            span = row_span(bounds, first + row, cols)
            ops = renderer.row_ops(line, cols, span)
            if ops:
                renderer.draw_row(cr, ops, PADDING_PX, PADDING_PX + row * metrics.cell_height)
        self._draw_cursor(cr, lines, offset)

    def _draw_cursor(self, cr, lines: list, offset: int) -> None:
        terminal = self.terminal
        row = terminal.y + offset
        if not terminal.cursor_visible or row >= terminal.rows or not self.input_enabled:
            return
        if self._focused and terminal.cursor_blink and not self._cursor_on:
            return
        metrics = self._renderer.metrics
        palette = terminal.palette
        line = lines[row]
        x = min(terminal.x, len(line.chars) - 1)
        char = line.chars[x] if x >= 0 else " "
        wide = x + 1 < len(line.chars) and line.chars[x + 1] == WIDE_TAIL
        left = PADDING_PX + x * metrics.cell_width
        top = PADDING_PX + row * metrics.cell_height
        width = metrics.cell_width * (2 if wide else 1)
        red, green, blue = palette.cursor_rgb
        cr.set_source_rgb(red / 255, green / 255, blue / 255)
        shape = terminal.cursor_shape
        if not self._focused:
            cr.set_line_width(1)
            cr.rectangle(math.floor(left) + 0.5, top + 0.5, math.ceil(width) - 1, metrics.cell_height - 1)
            cr.stroke()
        elif shape == "bar":
            cr.rectangle(math.floor(left), top, max(2, round(metrics.cell_height / 9)), metrics.cell_height)
            cr.fill()
        elif shape == "underline":
            thickness = max(2, round(metrics.cell_height / 9))
            cr.rectangle(left, top + metrics.cell_height - thickness, width, thickness)
            cr.fill()
        else:
            cr.rectangle(math.floor(left), top, math.ceil(width), metrics.cell_height)
            cr.fill()
            if char and char != " " and char != WIDE_TAIL:
                style = line.attrs[x]
                variant = self._renderer.colors(style, False).variant
                red, green, blue = palette.cursor_text_rgb
                cr.set_source_rgb(red / 255, green / 255, blue / 255)
                self._renderer.draw_glyph(cr, char, variant, left, top, 2 if wide else 1)
        self._im_cursor(left, top, width, metrics.cell_height)

    def _im_cursor(self, left: float, top: float, width: float, height: int) -> None:
        rect = Gdk.Rectangle()
        rect.x, rect.y, rect.width, rect.height = int(left), int(top), max(1, int(width)), height
        self._im.set_cursor_location(rect)

    def _update_blink(self) -> None:
        wants = self._focused and self.terminal.cursor_blink and self.terminal.cursor_visible
        if wants and self._blink_source is None:
            self._blink_source = GLib.timeout_add(BLINK_INTERVAL_MS, self._blink)
        elif not wants and self._blink_source is not None:
            GLib.source_remove(self._blink_source)
            self._blink_source = None
            self._cursor_on = True

    def _blink(self) -> bool:
        if not (self._focused and self.terminal.cursor_blink):
            self._blink_source = None
            self._cursor_on = True
            self._canvas.queue_draw()
            return GLib.SOURCE_REMOVE
        self._cursor_on = not self._cursor_on
        self._canvas.queue_draw()
        return GLib.SOURCE_CONTINUE

    def _guard(self, active: bool) -> None:
        if active == self._guarding:
            return
        if active:
            root = self.get_root()
            self._guarding = GUARD.acquire(root.get_application() if isinstance(root, Gtk.Window) else None)
        else:
            self._guarding = False
            GUARD.release()

    def _set_focused(self, focused: bool) -> None:
        self._guard(focused and not self._released)
        self._focused = focused
        self._cursor_on = True
        if focused:
            self._im.focus_in()
        else:
            self._im.focus_out()
        if self.terminal.focus_events:
            self._send(FOCUS_IN if focused else FOCUS_OUT)
        self._queue_redraw()

    def _reply(self, data: str) -> None:
        self._send(data)

    def _title_changed(self, title: str) -> None:
        if self.on_title:
            self.on_title(title)

    def _send(self, data: str) -> None:
        if self.on_input and self.input_enabled and data:
            self.on_input(data)

    def _user_input(self, data: str) -> None:
        if not data or not self.input_enabled:
            return
        self._cursor_on = True
        if self._offset:
            self._offset = 0
            self._queue_redraw()
        self._send(data)

    def _on_key_pressed(self, controller: Gtk.EventControllerKey, keyval: int, _keycode: int, state: Gdk.ModifierType) -> bool:
        name = Gdk.keyval_name(keyval) or ""
        mods = _modifiers(state)
        if self._shortcut(name, mods):
            return True
        event = controller.get_current_event()
        if not mods.ctrl and not mods.alt and event is not None and self._im.filter_keypress(event):
            return True
        codepoint = Gdk.keyval_to_unicode(keyval)
        char = chr(codepoint) if codepoint else ""
        data = encode_key(name, char, mods, self.terminal.app_cursor, self.terminal.app_keypad)
        if data is None:
            return False
        self._user_input(data)
        return True

    def _on_key_released(self, controller: Gtk.EventControllerKey, _keyval: int, _keycode: int, _state: Gdk.ModifierType) -> None:
        event = controller.get_current_event()
        if event is not None:
            self._im.filter_keypress(event)

    def _shortcut(self, name: str, mods: Modifiers) -> bool:
        lower = name.lower()
        if mods.ctrl and mods.shift and lower == "c":
            self.copy()
            return True
        if mods.ctrl and mods.shift and lower == "v":
            self.paste()
            return True
        if mods.shift and not mods.ctrl and not mods.alt and name in SCROLL_KEYS:
            page = max(1, self.terminal.rows - 1)
            self.scroll_lines(page if name in PAGE_UP_KEYS else -page)
            return True
        if mods.shift and mods.ctrl and name in ("Home", "End"):
            self._set_offset(self.terminal.buffer.history if name == "Home" else 0)
            return True
        if mods.ctrl and not mods.alt:
            if name in ZOOM_IN_KEYS:
                self.zoom(1)
                return True
            if name in ZOOM_OUT_KEYS:
                self.zoom(-1)
                return True
            if name in ZOOM_RESET_KEYS and not mods.shift:
                self.zoom(0)
                return True
        return False

    def _on_paste_ready(self, clipboard: Gdk.Clipboard, result: Gio.AsyncResult) -> None:
        try:
            text = clipboard.read_text_finish(result)
        except GLib.Error:
            return
        if text:
            self._user_input(encode_paste(text, self.terminal.bracketed_paste))

    def _cell_at(self, x: float, y: float, rounding: bool = False) -> tuple[int, int]:
        metrics = self._renderer.metrics
        raw_col = (x - PADDING_PX) / metrics.cell_width
        col = round(raw_col) if rounding else math.floor(raw_col)
        row = math.floor((y - PADDING_PX) / metrics.cell_height)
        return max(0, min(self.terminal.cols - (0 if rounding else 1), col)), max(0, min(self.terminal.rows - 1, row))

    def _point_at(self, x: float, y: float, rounding: bool = True) -> tuple[int, int]:
        col, _ = self._cell_at(x, y, rounding)
        metrics = self._renderer.metrics
        row = math.floor((y - PADDING_PX) / metrics.cell_height)
        buffer = self.terminal.buffer
        index = buffer.screen_index(row) - min(self._offset, buffer.history)
        return max(buffer.first_index, min(buffer.end_index - 1, index)), col

    def _mouse_reporting(self, mods: Modifiers) -> bool:
        return bool(self.terminal.mouse_mode) and not mods.shift and self.input_enabled

    def _report(self, button: int, x: float, y: float, pressed: bool, motion: bool, mods: Modifiers) -> None:
        col, row = self._cell_at(x, y)
        if motion and self._last_report_cell == (col, row):
            return
        self._last_report_cell = (col, row)
        if self.terminal.mouse_mode == MOUSE_X10 and (not pressed or motion):
            return
        data = encode_mouse(button, col, row, pressed, motion, mods, self.terminal.mouse_sgr)
        if data:
            self._send(data)

    def _click_count(self, x: float, y: float) -> int:
        settings = Gtk.Settings.get_default()
        interval = (settings.props.gtk_double_click_time if settings else 400) / 1000
        distance = settings.props.gtk_double_click_distance if settings else 5
        last_x, last_y, last_time, count = self._last_click
        now = time.monotonic()
        same = now - last_time <= interval and abs(x - last_x) <= distance and abs(y - last_y) <= distance
        count = count % 3 + 1 if same else 1
        self._last_click = (x, y, now, count)
        return count

    def _on_drag_begin(self, gesture: Gtk.GestureDrag, x: float, y: float) -> None:
        self._canvas.grab_focus()
        button = gesture.get_current_button()
        mods = _modifiers(gesture.get_current_event_state())
        self._drag_origin = (x, y)
        self._drag_point = (x, y)
        self._drag_button = button
        self._drag_mods = mods
        self._selecting = False
        self._reporting = False
        if self._mouse_reporting(mods) and button in BUTTONS:
            self._reporting = True
            self._last_report_cell = None
            self._report(BUTTONS[button], x, y, True, False, mods)
            return
        if button == Gdk.BUTTON_SECONDARY:
            self._popup_menu(x, y)
            return
        if button == Gdk.BUTTON_MIDDLE:
            self._paste_primary()
            return
        if button != Gdk.BUTTON_PRIMARY:
            return
        count = self._click_count(x, y)
        point = self._point_at(x, y, rounding=count == 1)
        mode = {1: "char", 2: "word", 3: "line"}[count]
        if count == 1 and mods.shift and self._selection is not None:
            self._selection.head = point
        else:
            self._selection = Selection(point, point, mode)
        self._selecting = True
        self._queue_redraw()
        if count > 1:
            self._export_primary()

    def _on_drag_update(self, _gesture: Gtk.GestureDrag, dx: float, dy: float) -> None:
        x, y = self._drag_origin[0] + dx, self._drag_origin[1] + dy
        self._drag_point = (x, y)
        if self._reporting:
            if self.terminal.mouse_mode in (MOUSE_BUTTON, MOUSE_ANY) and self._drag_button in BUTTONS:
                self._report(BUTTONS[self._drag_button], x, y, True, True, self._drag_mods)
            return
        if self._selecting and self._selection is not None:
            self._extend_selection(x, y)
            height = self._canvas.get_height()
            if (y < 0 or y > height) and self._autoscroll_source is None:
                self._autoscroll_source = GLib.timeout_add(SELECTION_AUTOSCROLL_MS, self._autoscroll)

    def _extend_selection(self, x: float, y: float) -> None:
        if self._selection is None:
            return
        self._selection.head = self._point_at(x, y, rounding=self._selection.mode == "char")
        self._queue_redraw()

    def _autoscroll(self) -> bool:
        x, y = self._drag_point
        height = self._canvas.get_height()
        if not self._selecting or 0 <= y <= height:
            self._autoscroll_source = None
            return GLib.SOURCE_REMOVE
        self.scroll_lines(1 if y < 0 else -1)
        self._extend_selection(x, y)
        return GLib.SOURCE_CONTINUE

    def _on_drag_end(self, _gesture: Gtk.GestureDrag, dx: float, dy: float) -> None:
        x, y = self._drag_origin[0] + dx, self._drag_origin[1] + dy
        if self._reporting:
            self._reporting = False
            if self._drag_button in BUTTONS:
                self._report(BUTTONS[self._drag_button], x, y, False, False, self._drag_mods)
            return
        if self._selecting:
            self._selecting = False
            if self._selection is not None and self._selection_bounds() is None:
                self._selection = None
                self._queue_redraw()
            self._export_primary()

    def _on_motion(self, _controller: Gtk.EventControllerMotion, x: float, y: float) -> None:
        self._pointer = (x, y)
        tracking = bool(self.terminal.mouse_mode) and self.input_enabled
        cursor = "default" if tracking else "text"
        if cursor != self._pointer_cursor:
            self._pointer_cursor = cursor
            self._canvas.set_cursor_from_name(cursor)
        if self.terminal.mouse_mode == MOUSE_ANY and not self._reporting and self.input_enabled:
            self._report(NO_BUTTON, x, y, True, True, Modifiers())

    def _on_scroll(self, controller: Gtk.EventControllerScroll, _dx: float, dy: float) -> bool:
        metrics = self._renderer.metrics
        mods = _modifiers(controller.get_current_event_state())
        if controller.get_unit() == Gdk.ScrollUnit.WHEEL:
            amount = dy * WHEEL_LINES
        else:
            amount = dy / metrics.cell_height
        self._scroll_accumulator += amount
        lines = int(self._scroll_accumulator)
        if lines == 0:
            return True
        self._scroll_accumulator -= lines
        terminal = self.terminal
        if self._mouse_reporting(mods):
            x, y = self._pointer
            button = WHEEL_UP if lines < 0 else WHEEL_DOWN
            for _ in range(max(1, abs(lines) // WHEEL_LINES)):
                col, row = self._cell_at(x, y)
                data = encode_mouse(button, col, row, True, False, mods, terminal.mouse_sgr)
                if data:
                    self._send(data)
            return True
        if terminal.alt_screen and terminal.alternate_scroll:
            key = "Up" if lines < 0 else "Down"
            data = encode_key(key, "", Modifiers(), terminal.app_cursor)
            if data:
                self._send(data * abs(lines))
            return True
        self.scroll_lines(-lines)
        return True

    def _selection_bounds(self):
        if self._selection is None:
            return None
        buffer = self.terminal.buffer
        return selection_range(self._selection, buffer.line_at, self.terminal.cols)

    def _selected_text(self) -> str:
        return selected_text(self._selection_bounds(), self.terminal.buffer.line_at, self.terminal.cols)

    def _export_primary(self) -> None:
        text = self._selected_text()
        if text:
            self.get_primary_clipboard().set(text)

    def _paste_primary(self) -> None:
        self.get_primary_clipboard().read_text_async(None, self._on_paste_ready)

    def _popup_menu(self, x: float, y: float) -> None:
        self._actions.lookup_action("copy").set_enabled(bool(self._selected_text()))
        self._actions.lookup_action("paste").set_enabled(self.input_enabled)
        rect = Gdk.Rectangle()
        rect.x, rect.y, rect.width, rect.height = int(x), int(y), 1, 1
        self._menu.set_pointing_to(rect)
        self._menu.popup()
