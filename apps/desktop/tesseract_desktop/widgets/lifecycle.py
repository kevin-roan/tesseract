from collections.abc import Callable

from gi.repository import Gtk

Detach = Callable[[], None]


def while_mapped(widget: Gtk.Widget, attach: Callable[[], Detach]) -> None:
    detach: list[Detach] = []

    def mapped(*_args) -> None:
        if not detach:
            detach.append(attach())

    def unmapped(*_args) -> None:
        while detach:
            detach.pop()()

    widget.connect("map", mapped)
    widget.connect("unmap", unmapped)
    if widget.get_mapped():
        mapped()
