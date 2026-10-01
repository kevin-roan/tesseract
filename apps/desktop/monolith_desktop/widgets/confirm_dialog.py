from collections.abc import Callable

from gi.repository import Adw, Gtk

from .choice_dropdown import ChoiceDropdown, Option

CONFIRM = "confirm"
CANCEL = "cancel"


def confirm(
    parent: Gtk.Widget | None,
    heading: str,
    body: str,
    confirm_label: str,
    cancel_label: str,
    on_confirm: Callable[[], None],
    destructive: bool = True,
) -> Adw.AlertDialog:
    dialog = Adw.AlertDialog(heading=heading, body=body)
    dialog.add_response(CANCEL, cancel_label)
    dialog.add_response(CONFIRM, confirm_label)
    dialog.set_response_appearance(
        CONFIRM, Adw.ResponseAppearance.DESTRUCTIVE if destructive else Adw.ResponseAppearance.SUGGESTED
    )
    dialog.set_default_response(CANCEL)
    dialog.set_close_response(CANCEL)
    dialog.connect("response", lambda _dialog, response: on_confirm() if response == CONFIRM else None)
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
) -> Adw.AlertDialog:
    dialog = Adw.AlertDialog(heading=heading, body=body)
    picker = ChoiceDropdown(options)
    picker.remove_css_class("flat")
    dialog.set_extra_child(picker)
    dialog.add_response(CANCEL, cancel_label)
    dialog.add_response(CONFIRM, confirm_label)
    dialog.set_response_appearance(CONFIRM, Adw.ResponseAppearance.SUGGESTED)
    dialog.set_response_enabled(CONFIRM, bool(options))
    dialog.set_default_response(CONFIRM)
    dialog.set_close_response(CANCEL)

    def responded(_dialog: Adw.AlertDialog, response: str) -> None:
        if response == CONFIRM and picker.selected_id is not None:
            on_choose(picker.selected_id)

    dialog.connect("response", responded)
    dialog.present(parent)
    return dialog
