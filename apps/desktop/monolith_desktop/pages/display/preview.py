from collections.abc import Callable

from gi.repository import Adw, Gdk, GLib, Gtk

from ...widgets import Notice, Text


class ScreenshotPreview(Gtk.Box):
    def __init__(self, title: str, message: str, action_label: str, loading_label: str, on_action: Callable[[], None]) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=12, css_classes=["to-display-preview"])
        self._notice = Notice(message, title, "warning", "display", action_label, on_action)
        self.append(self._notice)
        self._frames = Gtk.Stack(transition_type=Gtk.StackTransitionType.CROSSFADE, vexpand=True, hexpand=True)
        self._frames.add_css_class("to-display-stage")
        loading = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12, halign=Gtk.Align.CENTER, valign=Gtk.Align.CENTER)
        loading.append(Adw.Spinner(width_request=32, height_request=32))
        loading.append(Text(loading_label, "caption", "textSecondary"))
        self._frames.add_named(loading, "loading")
        self._picture = Gtk.Picture(content_fit=Gtk.ContentFit.CONTAIN, can_shrink=True, hexpand=True, vexpand=True)
        self._frames.add_named(self._picture, "picture")
        self.append(self._frames)

    def show_png(self, data: bytes) -> None:
        try:
            texture = Gdk.Texture.new_from_bytes(GLib.Bytes.new(data))
        except GLib.Error:
            return
        self._picture.set_paintable(texture)
        self._frames.set_visible_child_name("picture")

    def clear(self) -> None:
        self._picture.set_paintable(None)
        self._frames.set_visible_child_name("loading")
