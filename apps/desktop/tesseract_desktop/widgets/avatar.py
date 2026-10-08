from gi.repository import Gdk, Gtk

from ..theme.tokens import AVATAR_SIZE
from ..util.text import initials_of
from .text import Text


class Avatar(Gtk.Overlay):
    def __init__(self, name: str, size: int = AVATAR_SIZE["md"], texture: Gdk.Texture | None = None, variant: str = "caption") -> None:
        super().__init__(css_classes=["to-avatar"], halign=Gtk.Align.START, valign=Gtk.Align.CENTER)
        self.set_size_request(size, size)
        self.set_overflow(Gtk.Overflow.HIDDEN)
        self._initials = Text(initials_of(name), variant, "textSecondary", center=True)
        self._initials.set_halign(Gtk.Align.CENTER)
        self._initials.set_valign(Gtk.Align.CENTER)
        self.set_child(self._initials)
        self._picture = Gtk.Picture(content_fit=Gtk.ContentFit.COVER, can_shrink=True)
        self._picture.set_size_request(size, size)
        self.add_overlay(self._picture)
        self.set_texture(texture)

    def set_name(self, name: str) -> None:
        self._initials.set_label(initials_of(name))

    def set_texture(self, texture: Gdk.Texture | None) -> None:
        self._picture.set_paintable(texture)
        self._picture.set_visible(texture is not None)
