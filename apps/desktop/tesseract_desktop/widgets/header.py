from collections.abc import Callable
from dataclasses import dataclass

from gi.repository import Gtk

from .buttons import IconButton
from .text import Text


@dataclass(frozen=True)
class HeaderAction:
    id: str
    icon: str
    label: str
    on_activate: Callable[[], None]
    sensitive: bool = True


class ScreenHeader(Gtk.Box):
    def __init__(
        self,
        title: str,
        subtitle: str | None = None,
        actions: list[HeaderAction] | None = None,
        accessory: Gtk.Widget | None = None,
        large: bool = True,
    ) -> None:
        super().__init__(spacing=8)
        self.add_css_class("to-screen-header")
        titles = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, hexpand=True)
        self._title = Text(title, "h1" if large else "h3")
        self._subtitle = Text(subtitle or "", "caption", "textSecondary")
        self._subtitle.set_visible(bool(subtitle))
        titles.append(self._title)
        titles.append(self._subtitle)
        self._accessory = Gtk.Box()
        if accessory is not None:
            self._accessory.append(accessory)
        titles.append(self._accessory)
        self.append(titles)
        self._actions = Gtk.Box(spacing=4, valign=Gtk.Align.CENTER)
        self.append(self._actions)
        self._buttons: dict[str, IconButton] = {}
        self.set_actions(actions or [])

    def set_title(self, title: str) -> None:
        self._title.set_label(title)

    def set_subtitle(self, subtitle: str | None) -> None:
        self._subtitle.set_text_value(subtitle)

    def set_accessory(self, widget: Gtk.Widget | None) -> None:
        while (child := self._accessory.get_first_child()) is not None:
            self._accessory.remove(child)
        if widget is not None:
            self._accessory.append(widget)

    def set_actions(self, actions: list[HeaderAction]) -> None:
        while (child := self._actions.get_first_child()) is not None:
            self._actions.remove(child)
        self._buttons = {}
        for action in actions:
            button = IconButton(action.icon, action.label, action.on_activate)
            button.set_sensitive(action.sensitive)
            self._buttons[action.id] = button
            self._actions.append(button)

    def action_button(self, action_id: str) -> IconButton | None:
        return self._buttons.get(action_id)
