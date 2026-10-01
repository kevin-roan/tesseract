from gi.repository import Gtk

from ..pairing import qr_texture

QR_SIZE = 240


class QrCode(Gtk.Box):
    def __init__(self, text: str | None = None, size: int = QR_SIZE, dark: str = "#000000", light: str = "#ffffff") -> None:
        super().__init__(css_classes=["to-qr"], halign=Gtk.Align.CENTER, valign=Gtk.Align.CENTER)
        self._dark, self._light = dark, light
        self._picture = Gtk.Picture(can_shrink=True, content_fit=Gtk.ContentFit.CONTAIN)
        self._picture.set_size_request(size, size)
        self.append(self._picture)
        self.set_text(text)

    def set_text(self, text: str | None) -> None:
        self._picture.set_paintable(qr_texture(text, self._dark, self._light, scale=8, border=0) if text else None)
