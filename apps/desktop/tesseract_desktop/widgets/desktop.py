from collections.abc import Callable

from gi.repository import Gdk, GLib, Gtk


def open_uri(window: Gtk.Window | None, uri: str, on_error: Callable[[str], None] | None = None) -> None:
    launcher = Gtk.UriLauncher.new(uri)

    def finished(source: Gtk.UriLauncher, result) -> None:
        try:
            source.launch_finish(result)
        except GLib.Error as error:
            if on_error and not error.matches(Gtk.dialog_error_quark(), Gtk.DialogError.DISMISSED):
                on_error(error.message)

    launcher.launch(window, None, finished)


def copy_text(widget: Gtk.Widget, text: str) -> None:
    widget.get_clipboard().set_content(Gdk.ContentProvider.new_for_value(text))
