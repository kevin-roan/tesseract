from collections.abc import Callable

from gi.repository import Gtk

from .choice_dropdown import ChoiceDropdown, Option
from .dialog import DialogShell
from .text import Text

CONFIRM_WIDTH = 420


class ConfirmDialog(DialogShell):
    def __init__(self, heading: str, body: str, confirm_label: str, cancel_label: str, destructive: bool = True) -> None:
        super().__init__(heading, width=CONFIRM_WIDTH)
        self.add_css_class("to-confirm-dialog")
        self.message = Text(body, "body", "textSecondary", wrap=True, lines=None)
        self.message.set_visible(bool(body))
        self.body.append(self.message)
        self.cancel = self.add_action(cancel_label, self.close)
        self.confirm = self.add_action(confirm_label, None, "destructive" if destructive else "primary")
        self.set_default_widget(self.confirm)
        self.set_focus(self.cancel if destructive else self.confirm)

    def on_confirm(self, callback: Callable[[], None]) -> None:
        def clicked(*_args) -> None:
            self.close()
            callback()

        self.confirm.connect("clicked", clicked)


def confirm(
    parent: Gtk.Widget | None,
    heading: str,
    body: str,
    confirm_label: str,
    cancel_label: str,
    on_confirm: Callable[[], None],
    destructive: bool = True,
) -> ConfirmDialog:
    dialog = ConfirmDialog(heading, body, confirm_label, cancel_label, destructive)
    dialog.on_confirm(on_confirm)
    dialog.present(parent)
    return dialog


def choose(
    parent: Gtk.Widget | None,
    heading: str,
    body: str,
    options: list[Option],
    confirm_label: str,
    cancel_label: str,
    on_choose: Callable[[str], None],
) -> ConfirmDialog:
    dialog = ConfirmDialog(heading, body, confirm_label, cancel_label, destructive=False)
    picker = ChoiceDropdown(options)
    picker.remove_css_class("flat")
    picker.set_halign(Gtk.Align.FILL)
    dialog.body.append(picker)
    dialog.confirm.set_sensitive(bool(options))
    dialog.on_confirm(lambda: picker.selected_id is not None and on_choose(picker.selected_id))
    dialog.present(parent)
    return dialog
