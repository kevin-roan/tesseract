"""Render the desktop app to PNG files, headless, for visual checks.

    tools/snapshot.sh out.png [--page ID] [--params JSON] [--width W] [--height H] [--delay S]
                              [--prefs [ID]] [--dark|--light] [--collapsed-sidebar]

Runs the real app (real controller connection) on a private broadway display,
navigates to --page, waits --delay seconds for data, then snapshots the main
window (with the Preferences dialog open when --prefs is given) into out.png.
Animations are disabled because broadway has no client driving the frame clock,
so transitions (dialogs, stacks, revealers) would otherwise never finish.
Broadway's virtual monitor is 1024x768, so larger sizes are clamped.
"""

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from monolith_desktop.app import MonolithApplication  # noqa: E402

from gi.repository import Adw, GLib, Graphene, Gtk  # noqa: E402


RENDER_ATTEMPTS = 25
RETRY_MS = 200


def _node(widget: Gtk.Widget):
    snapshot = Gtk.Snapshot()
    Gtk.WidgetPaintable.new(widget).snapshot(snapshot, widget.get_width(), widget.get_height())
    return snapshot.to_node()


def render(window: Gtk.Widget, path: str) -> bool:
    node = _node(window)
    if node is None:
        window.allocate(window.get_width(), window.get_height(), -1, None)
        node = _node(window)
    if node is None:
        return False
    width, height = window.get_width(), window.get_height()
    renderer = window.get_native().get_renderer()
    texture = renderer.render_texture(node, Graphene.Rect().init(0, 0, width, height))
    texture.save_to_png(path)
    print(f"wrote {path} ({width}x{height})")
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("out")
    parser.add_argument("--page", default=None)
    parser.add_argument("--params", default=None, help="JSON navigation params for --page")
    parser.add_argument("--width", type=int, default=1024)
    parser.add_argument("--height", type=int, default=768)
    parser.add_argument("--delay", type=float, default=4.0)
    parser.add_argument("--prefs", nargs="?", const="", default=None, help="open Preferences, optionally on page ID")
    parser.add_argument("--dark", action="store_true")
    parser.add_argument("--light", action="store_true")
    parser.add_argument("--collapsed-sidebar", action="store_true", help="show the sidebar page when collapsed")
    args = parser.parse_args()
    params = json.loads(args.params) if args.params else None

    app = MonolithApplication()

    attempts = [0]

    def ready() -> bool:
        attempts[0] += 1
        if not render(app.window, args.out):
            if attempts[0] < RENDER_ATTEMPTS:
                app.window.queue_resize()
                return GLib.SOURCE_CONTINUE
            print("nothing rendered", file=sys.stderr)
        app.quit_app()
        return GLib.SOURCE_REMOVE

    def open_page() -> bool:
        app.navigate(args.page, params)
        return GLib.SOURCE_REMOVE

    def open_prefs() -> bool:
        app.ctx.open_preferences(args.prefs or None)
        return GLib.SOURCE_REMOVE

    def show_sidebar() -> bool:
        app.window.show_sidebar()
        return GLib.SOURCE_REMOVE

    def started(*_a) -> None:
        Gtk.Settings.get_default().set_property("gtk-enable-animations", False)
        if args.dark or args.light:
            Adw.StyleManager.get_default().set_color_scheme(
                Adw.ColorScheme.FORCE_DARK if args.dark else Adw.ColorScheme.FORCE_LIGHT
            )
        window = app.ensure_window()
        window.set_default_size(args.width, args.height)
        window.present()
        if args.page:
            GLib.timeout_add(300, open_page)
        if args.collapsed_sidebar:
            GLib.timeout_add(int(args.delay * 1000) - 400, show_sidebar)
        if args.prefs is not None:
            GLib.timeout_add(600, open_prefs)
        GLib.timeout_add(int(args.delay * 1000), lambda: GLib.timeout_add(RETRY_MS, ready) and False)

    app.connect("startup", lambda *_: GLib.idle_add(started))
    app.set_application_id(None)
    app.run([sys.argv[0]])


if __name__ == "__main__":
    main()
