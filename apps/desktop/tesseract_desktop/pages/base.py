from typing import TYPE_CHECKING, Any, ClassVar

from ..store import Observable

if TYPE_CHECKING:
    from gi.repository import Gtk

    from ..context import AppContext


class Page:
    id: ClassVar[str]
    title: ClassVar[str]
    icon: ClassVar[str]
    section: ClassVar[str] = "sandbox"
    order: ClassVar[int] = 100
    requires_connection: ClassVar[bool] = True

    def __init__(self, ctx: "AppContext") -> None:
        self.ctx = ctx

    @classmethod
    def badge(cls, ctx: "AppContext") -> Observable[int | None] | None:
        return None

    def build(self) -> "Gtk.Widget":
        raise NotImplementedError

    def header_widgets(self) -> "list[Gtk.Widget]":
        return []

    def on_shown(self) -> None:
        pass

    def on_hidden(self) -> None:
        pass

    def open(self, params: dict[str, Any]) -> None:
        pass

    def push(self, title: str, widget: "Gtk.Widget", header_widgets: "list[Gtk.Widget] | None" = None, tag: str | None = None):
        return self.ctx.push(title, widget, header_widgets, tag)
