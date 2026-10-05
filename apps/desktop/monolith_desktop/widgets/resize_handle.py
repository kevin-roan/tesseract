from collections.abc import Callable

from gi.repository import Graphene, Gtk


class ResizeHandle(Gtk.Box):
    """An invisible vertical edge that reports horizontal drags in window pixels, even while it moves with the edge."""

    def __init__(
        self,
        on_begin: Callable[[], None],
        on_drag: Callable[[float], None],
        on_end: Callable[[], None],
        on_reset: Callable[[], None],
    ) -> None:
        super().__init__(css_classes=["to-resize-handle"], halign=Gtk.Align.END, vexpand=True)
        self.set_cursor_from_name("col-resize")
        self._on_begin, self._on_drag, self._on_end = on_begin, on_drag, on_end
        self._origin: float | None = None

        drag = Gtk.GestureDrag()
        drag.connect("drag-begin", self._begin)
        drag.connect("drag-update", self._update)
        drag.connect("drag-end", self._end)
        self.add_controller(drag)

        click = Gtk.GestureClick()
        click.connect("pressed", lambda _gesture, presses, _x, _y: on_reset() if presses == 2 else None)
        self.add_controller(click)

    def _window_x(self, x: float, y: float) -> float | None:
        root = self.get_root()
        if root is None:
            return None
        ok, point = self.compute_point(root, Graphene.Point().init(x, y))
        return point.x if ok else None

    def _begin(self, _gesture: Gtk.GestureDrag, x: float, y: float) -> None:
        self._origin = self._window_x(x, y)
        if self._origin is not None:
            self.add_css_class("dragging")
            self._on_begin()

    def _update(self, gesture: Gtk.GestureDrag, dx: float, dy: float) -> None:
        if self._origin is None:
            return
        _ok, x, y = gesture.get_start_point()
        current = self._window_x(x + dx, y + dy)
        if current is not None:
            self._on_drag(current - self._origin)

    def _end(self, _gesture: Gtk.GestureDrag, _dx: float, _dy: float) -> None:
        if self._origin is None:
            return
        self._origin = None
        self.remove_css_class("dragging")
        self._on_end()
