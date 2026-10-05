from gi.repository import Gtk

from ..pairing import qr_texture

QR_SIZE = 200


class QrCode(Gtk.Box):
    """A QR code on a white rounded tile; `size` is the code's edge in pixels, without the tile padding."""

    def __init__(self, text: str | None = None, size: int = QR_SIZE, dark: str = "#000000", light: str = "#ffffff") -> None:
        super().__init__(css_classes=["to-qr"], halign=Gtk.Align.CENTER, valign=Gtk.Align.CENTER)
        self._dark, self._light = dark, light
        self._image = Gtk.Image(pixel_size=size)
        self.append(self._image)
        self.set_text(text)

    def set_text(self, text: str | None) -> None:
        self._image.set_from_paintable(qr_texture(text, self._dark, self._light, scale=8, border=0) if text else None)
