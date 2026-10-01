from collections.abc import Callable, Sequence

from gi.repository import Gdk, Gio, Graphene, Gtk

NAMESPACE = "menu"

MenuEntry = tuple[str, Callable[[], None]]


class ActionMenu(Gtk.PopoverMenu):
    def __init__(self) -> None:
        super().__init__(has_arrow=False, halign=Gtk.Align.START)
        self._group = Gio.SimpleActionGroup()
        self.insert_action_group(NAMESPACE, self._group)

    def set_entries(self, sections: Sequence[Sequence[MenuEntry]]) -> bool:
        for name in self._group.list_actions():
            self._group.remove_action(name)
        menu = Gio.Menu()
        index = 0
        for section in sections:
            if not section:
                continue
            items = Gio.Menu()
            for label, callback in section:
                name = f"item-{index}"
                index += 1
                action = Gio.SimpleAction.new(name, None)
                action.connect("activate", lambda *_args, fn=callback: fn())
                self._group.add_action(action)
                items.append(label, f"{NAMESPACE}.{name}")
            menu.append_section(None, items)
        self.set_menu_model(menu)
        return index > 0

    def popup_at(self, widget: Gtk.Widget, x: float, y: float) -> None:
        parent = self.get_parent()
        if parent is None:
            return
        found, point = widget.compute_point(parent, Graphene.Point().init(x, y))
        if not found:
            return
        rect = Gdk.Rectangle()
        rect.x, rect.y, rect.width, rect.height = int(point.x), int(point.y), 1, 1
        self.set_pointing_to(rect)
        self.popup()


def attach_context_menu(widget: Gtk.Widget, on_request: Callable[[float, float], None]) -> None:
    def clicked(gesture: Gtk.GestureClick, _n: int, x: float, y: float) -> None:
        gesture.set_state(Gtk.EventSequenceState.CLAIMED)
        on_request(x, y)

    def keyboard(*_args: object) -> bool:
        on_request(widget.get_width() / 2, widget.get_height() / 2)
        return True

    click = Gtk.GestureClick(button=Gdk.BUTTON_SECONDARY)
    click.connect("pressed", clicked)
    widget.add_controller(click)
    press = Gtk.GestureLongPress(touch_only=True)
    press.connect("pressed", lambda _gesture, x, y: on_request(x, y))
    widget.add_controller(press)
    shortcuts = Gtk.ShortcutController()
    shortcuts.add_shortcut(
        Gtk.Shortcut(trigger=Gtk.ShortcutTrigger.parse_string("<Shift>F10|Menu"), action=Gtk.CallbackAction.new(keyboard))
    )
    widget.add_controller(shortcuts)
