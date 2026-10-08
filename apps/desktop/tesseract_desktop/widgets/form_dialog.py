from collections.abc import Callable

from gi.repository import Adw, Gtk

from .buttons import Chip
from .dialog import DIALOG_WIDTH, DialogShell, PropertyChips, TitleEntry
from .feedback import Notice
from .motion import crossfade_stack
from .text import Text

FORM_PAGE = "form"


class FieldGroup(Gtk.Box):
    """A titled block of form fields with a hint line and the group's validation errors."""

    def __init__(self, title: str | None = None, description: str | None = None) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=8, css_classes=["to-field-group"])
        self._title = Text(title or "", "label")
        self._title.set_visible(bool(title))
        self.fields = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        self._description = Text(description or "", "caption", "textSecondary", wrap=True, lines=None)
        self._description.set_visible(bool(description))
        self.errors = Text("", "caption", "danger", wrap=True, lines=None)
        self.errors.set_visible(False)
        for widget in (self._title, self.fields, self._description, self.errors):
            self.append(widget)

    def set_description(self, description: str | None) -> None:
        self._description.set_text_value(description)

    def add(self, widget: Gtk.Widget) -> None:
        self.fields.append(widget)


class FormField(Gtk.Box):
    def __init__(self, title: str | None, entry: Gtk.Widget) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=6, css_classes=["to-form-field"])
        if title:
            self.append(Text(title, "overline", "textSecondary"))
        self.append(entry)


class FormDialog(DialogShell):
    """A Linear-style form modal: optional big title input, compact labelled fields, property chips,
    inline errors and a footer with Cancel on the left and the primary pill on the right."""

    def __init__(
        self,
        title: str,
        subtitle: str | None,
        submit_label: str,
        on_submit: Callable[[], None],
        cancel_label: str,
        width: int = DIALOG_WIDTH,
        height: int | None = None,
        context: str | None = None,
        icon: str | None = None,
    ) -> None:
        super().__init__(title, context, icon, width, height)
        self._fields: dict[str, tuple[Gtk.Widget, Text]] = {}
        self._group_errors: dict[Text, dict[str, str]] = {}
        self._group_labels: dict[FieldGroup, Text] = {}
        self._primary_cb: Callable[[], None] | None = on_submit
        self._secondary_cb: Callable[[], None] | None = self.close
        self._busy = False

        self._subtitle = Text(subtitle or "", "caption", "textSecondary", wrap=True, lines=None)
        self._subtitle.set_visible(bool(subtitle))
        self.body.append(self._subtitle)
        self._error = Notice("", tone="danger")
        self._error.set_visible(False)
        self.body.append(self._error)
        self._chips: PropertyChips | None = None
        self._chip_hints = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4, visible=False)

        self._stack = crossfade_stack(vhomogeneous=False, vexpand=True)
        self.set_content(self._stack)
        self._stack.add_named(self.scroller, FORM_PAGE)

        self._spinner = Adw.Spinner(width_request=16, height_request=16, visible=False)
        self._secondary = self.add_action(cancel_label, lambda: self._secondary_cb and self._secondary_cb(), start=True)
        self.footer_end.append(self._spinner)
        self._primary = self.add_action(submit_label, self.submit, "primary")

    def add_title(self, group: FieldGroup, key: str, placeholder: str, text: str = "", monospace: bool = False) -> TitleEntry:
        entry = TitleEntry(placeholder, text, monospace)
        group.add(entry)
        self._register(key, entry, group)
        return entry

    def add_group(self, title: str | None = None, description: str | None = None) -> FieldGroup:
        group = FieldGroup(title, description)
        self._append(group)
        self._group_labels[group] = group.errors
        self._group_errors[group.errors] = {}
        return group

    def add_entry(
        self, group: FieldGroup, key: str, title: str, text: str = "", monospace: bool = False, password: bool = False
    ) -> Gtk.Entry | Gtk.PasswordEntry:
        entry = Gtk.PasswordEntry(show_peek_icon=True, text=text) if password else Gtk.Entry(text=text)
        entry.add_css_class("to-form-entry")
        if monospace:
            entry.add_css_class("monospace")
        group.add(FormField(title, entry))
        self._register(key, entry, group)
        return entry

    def add_switch(self, group: FieldGroup, title: str, subtitle: str | None = None, active: bool = False) -> Gtk.Switch:
        switch = Gtk.Switch(active=active, valign=Gtk.Align.CENTER)
        row = Gtk.Box(spacing=12, css_classes=["to-form-switch"])
        texts = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, hexpand=True, valign=Gtk.Align.CENTER)
        texts.append(Text(title, "body"))
        if subtitle:
            texts.append(Text(subtitle, "caption", "textSecondary", wrap=True, lines=None))
        row.append(texts)
        row.append(switch)
        group.add(row)
        return switch

    def add_chip(self, label: str, icon: str | None = None, hint: str | None = None, active: bool = False) -> Chip:
        if self._chips is None:
            self._chips = PropertyChips()
            self._append(self._chips)
            self._append(self._chip_hints)
        chip = Chip(label, active, icon)
        if hint:
            chip.set_tooltip_text(hint)
            note = Text(hint, "caption", "textSecondary", wrap=True, lines=None)
            note.set_visible(active)
            chip.connect("notify::active", lambda button, _param: self._show_hint(note, button.get_active()))
            self._chip_hints.append(note)
            self._chip_hints.set_visible(self._chip_hints.get_visible() or active)
        self._chips.add(chip)
        return chip

    def _show_hint(self, note: Text, visible: bool) -> None:
        note.set_visible(visible)
        child = self._chip_hints.get_first_child()
        while child is not None and not child.get_visible():
            child = child.get_next_sibling()
        self._chip_hints.set_visible(child is not None)

    def _append(self, widget: Gtk.Widget) -> None:
        self.body.append(widget)

    def _register(self, key: str, entry: Gtk.Widget, group: FieldGroup) -> None:
        entry.connect("activate", lambda *_: self.submit())
        entry.connect("changed", lambda *_: self.set_field_error(key, None))
        self._fields[key] = (entry, self._group_labels[group])

    def set_field_error(self, key: str, message: str | None) -> None:
        entry = self._fields.get(key)
        if entry is None:
            return
        row, label = entry
        if message:
            row.add_css_class("error")
        else:
            row.remove_css_class("error")
        messages = self._group_errors[label]
        if message:
            messages[key] = message
        else:
            messages.pop(key, None)
        label.set_text_value("\n".join(messages.values()) or None)

    def set_field_errors(self, errors: dict[str, str]) -> None:
        for key in self._fields:
            self.set_field_error(key, errors.get(key))
        first = next((self._fields[key][0] for key in self._fields if key in errors), None)
        if first is not None:
            first.grab_focus()

    def set_error(self, message: str | None) -> None:
        self._error.set_visible(bool(message))
        if message:
            self._error.update(message, tone="danger")

    def set_busy(self, busy: bool) -> None:
        self._busy = busy
        self._spinner.set_visible(busy)
        self._primary.set_sensitive(not busy)
        for row, _label in self._fields.values():
            row.set_sensitive(not busy)

    @property
    def busy(self) -> bool:
        return self._busy

    def submit(self) -> None:
        if not self._busy and self._primary.get_visible() and self._primary.get_sensitive() and self._primary_cb:
            self._primary_cb()

    def set_primary(self, label: str | None, callback: Callable[[], None] | None = None) -> None:
        self._primary.set_visible(bool(label))
        if label:
            self._primary.set_label_text(label)
            self._primary.set_sensitive(True)
        self._primary_cb = callback

    def set_secondary(self, label: str | None, callback: Callable[[], None] | None = None) -> None:
        self._secondary.set_visible(bool(label))
        if label:
            self._secondary.set_label_text(label)
        self._secondary_cb = callback or self.close

    def add_page(self, name: str, widget: Gtk.Widget) -> None:
        self._stack.add_named(widget, name)

    def show_page(self, name: str) -> None:
        self._stack.set_visible_child_name(name)
