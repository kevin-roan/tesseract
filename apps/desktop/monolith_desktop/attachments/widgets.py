from collections import OrderedDict
from collections.abc import Callable

import gi

gi.require_version("GdkPixbuf", "2.0")
from gi.repository import Adw, Gdk, GdkPixbuf, Gio, GLib, Gtk, Pango  # noqa: E402

from ..api.tasks import run_async  # noqa: E402
from ..api.types import Upload, UploadKind  # noqa: E402
from ..strings import ATTACHMENTS as S  # noqa: E402
from ..util.format import format_bytes  # noqa: E402
from ..theme.icons import resolve_icon  # noqa: E402
from ..widgets.icon import Icon  # noqa: E402
from ..widgets.text import Text  # noqa: E402
from .model import KIND_ICONS, Status  # noqa: E402

THUMB_PX = 56
LARGE_THUMB_PX = 160
NAME_CHARS = 22
NAME_MIN_CHARS = 12
CACHE_SIZE = 32

ThumbSource = Callable[[], bytes]

_cache: "OrderedDict[str, Gdk.Texture]" = OrderedDict()


def _square_pixbuf(data: bytes, size: int) -> GdkPixbuf.Pixbuf:
    """A centre-cropped square of `size` at 2x, so thumbnails stay sharp on HiDPI screens."""
    stream = Gio.MemoryInputStream.new_from_bytes(GLib.Bytes.new(data))
    pixbuf = GdkPixbuf.Pixbuf.new_from_stream(stream, None)
    pixbuf = pixbuf.apply_embedded_orientation() or pixbuf
    target = size * 2
    scale = target / max(1, min(pixbuf.get_width(), pixbuf.get_height()))
    width, height = max(target, round(pixbuf.get_width() * scale)), max(target, round(pixbuf.get_height() * scale))
    scaled = pixbuf.scale_simple(width, height, GdkPixbuf.InterpType.BILINEAR)
    return scaled.new_subpixbuf((width - target) // 2, (height - target) // 2, target, target).copy()


def _texture(pixbuf: GdkPixbuf.Pixbuf) -> Gdk.Texture:
    memory_format = Gdk.MemoryFormat.R8G8B8A8 if pixbuf.get_has_alpha() else Gdk.MemoryFormat.R8G8B8
    return Gdk.MemoryTexture.new(
        pixbuf.get_width(), pixbuf.get_height(), memory_format, pixbuf.read_pixel_bytes(), pixbuf.get_rowstride()
    )


def _remember(key: str, texture: Gdk.Texture) -> None:
    _cache[key] = texture
    _cache.move_to_end(key)
    while len(_cache) > CACHE_SIZE:
        _cache.popitem(last=False)


class AttachmentChip(Gtk.Box):
    """One attachment: a thumbnail for images, otherwise a pill with the kind icon, name and size."""

    def __init__(
        self,
        name: str,
        kind: UploadKind,
        meta: str | None = None,
        load_thumbnail: tuple[str, ThumbSource] | None = None,
        large: bool = False,
        on_remove: Callable[[], None] | None = None,
        on_retry: Callable[[], None] | None = None,
    ) -> None:
        super().__init__(css_classes=["to-attachment"])
        self._name = name
        self._meta = meta
        self._on_retry = on_retry
        self._image = kind == "image" and load_thumbnail is not None
        size = LARGE_THUMB_PX if large else THUMB_PX
        self.update_property([Gtk.AccessibleProperty.LABEL], [name])
        self.set_tooltip_text(name if not meta else f"{name} · {meta}")

        self._status = Gtk.Stack(hhomogeneous=False, vhomogeneous=False, valign=Gtk.Align.CENTER, halign=Gtk.Align.CENTER)
        self._status.add_named(Gtk.Box(), "ready")
        self._status.add_named(Adw.Spinner(width_request=16, height_request=16), "uploading")
        retry = Gtk.Button(child=Icon("refresh", "sm", "danger"), css_classes=["flat", "circular", "to-attachment-action"])
        retry.set_tooltip_text(S["retry"].format(name=name))
        retry.update_property([Gtk.AccessibleProperty.LABEL], [S["retry"].format(name=name)])
        retry.connect("clicked", lambda *_: self._on_retry and self._on_retry())
        self._status.add_named(retry, "error")

        remove = None
        if on_remove is not None:
            remove = Gtk.Button(child=Icon("close", "xs"), css_classes=["flat", "circular", "to-attachment-remove"], valign=Gtk.Align.START)
            remove.set_tooltip_text(S["remove"].format(name=name))
            remove.update_property([Gtk.AccessibleProperty.LABEL], [S["remove"].format(name=name)])
            remove.connect("clicked", lambda *_: on_remove())

        if self._image:
            self.set_overflow(Gtk.Overflow.HIDDEN)
            self.add_css_class("thumb")
            if large:
                self.add_css_class("large")
            self._picture = Gtk.Image(pixel_size=size, icon_name=resolve_icon("image"))
            overlay = Gtk.Overlay(child=self._picture)
            overlay.add_overlay(self._status)
            if remove is not None:
                remove.set_halign(Gtk.Align.END)
                remove.add_css_class("floating")
                overlay.add_overlay(remove)
            self.append(overlay)
            if load_thumbnail is not None:
                self._load(*load_thumbnail, size)
            self._caption = None
            return

        self.add_css_class("pill")
        self.set_spacing(8)
        self.set_valign(Gtk.Align.CENTER)
        tile = Gtk.Box(css_classes=["to-attachment-icon"], valign=Gtk.Align.CENTER)
        icon = Icon(KIND_ICONS[kind], "sm", "textSecondary")
        icon.set_hexpand(True)
        icon.set_halign(Gtk.Align.CENTER)
        tile.append(icon)
        self.append(tile)
        body = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, valign=Gtk.Align.CENTER)
        label = Text(name, "label")
        label.set_max_width_chars(NAME_CHARS)
        label.set_width_chars(min(len(name), NAME_MIN_CHARS))
        label.set_ellipsize(Pango.EllipsizeMode.MIDDLE)
        body.append(label)
        self._caption = Text(meta or "", "caption", "textTertiary")
        self._caption.set_max_width_chars(NAME_CHARS + 6)
        self._caption.set_visible(bool(meta))
        body.append(self._caption)
        self.append(body)
        self.append(self._status)
        if remove is not None:
            remove.set_valign(Gtk.Align.CENTER)
            self.append(remove)

    def set_status(self, status: Status, error: str | None = None) -> None:
        self._status.set_visible_child_name(status if status != "error" or self._on_retry else "ready")
        if status == "error":
            self.add_css_class("failed")
        else:
            self.remove_css_class("failed")
        tooltip = f"{self._name}. {error}" if status == "error" and error else self._name
        self.set_tooltip_text(tooltip)
        if self._caption is not None:
            failed = status == "error" and bool(error)
            self._caption.set_label(error if failed and error else self._meta or "")
            self._caption.set_color("danger" if failed else "textTertiary")
            self._caption.set_visible(failed or bool(self._meta))

    def _load(self, key: str, source: ThumbSource, size: int) -> None:
        cache_key = f"{key}@{size}"
        cached = _cache.get(cache_key)
        if cached is not None:
            self._picture.set_from_paintable(cached)
            return

        def loaded(texture: Gdk.Texture) -> None:
            _remember(cache_key, texture)
            self._picture.set_from_paintable(texture)

        run_async(lambda: _texture(_square_pixbuf(source(), size)), on_success=loaded, on_error=lambda _e: None)


class AttachmentTray(Gtk.Box):
    """A horizontally scrolling row of chips; hidden while empty."""

    def __init__(self, css_class: str = "to-attachment-tray") -> None:
        super().__init__(css_classes=[css_class])
        self._row = Gtk.Box(spacing=8)
        scroller = Gtk.ScrolledWindow(
            child=self._row,
            hexpand=True,
            vscrollbar_policy=Gtk.PolicyType.NEVER,
            hscrollbar_policy=Gtk.PolicyType.AUTOMATIC,
            propagate_natural_height=True,
        )
        self.append(scroller)
        self.set_visible(False)

    def append_chip(self, chip: Gtk.Widget) -> None:
        self._row.append(chip)
        self.set_visible(True)

    def remove_chip(self, chip: Gtk.Widget) -> None:
        self._row.remove(chip)
        self.set_visible(self._row.get_first_child() is not None)

    def clear(self) -> None:
        while (child := self._row.get_first_child()) is not None:
            self._row.remove(child)
        self.set_visible(False)


def upload_chip(upload: Upload, fetch: Callable[[str], bytes] | None, large: bool = False) -> AttachmentChip:
    """A sent attachment; images load their thumbnail from the controller through `fetch`."""
    loader = (upload["id"], lambda: fetch(upload["id"])) if fetch and upload.get("kind") == "image" else None
    return AttachmentChip(upload["name"], upload.get("kind", "file"), format_bytes(upload.get("sizeBytes")), load_thumbnail=loader, large=large)
