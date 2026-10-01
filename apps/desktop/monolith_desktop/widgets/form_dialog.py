from collections.abc import Callable

from gi.repository import Adw, Gtk

from .buttons import ActionButton
from .feedback import Notice
from .text import Text

FORM_PAGE = "form"
DIALOG_WIDTH = 520
DIALOG_HEIGHT = 560


class FormDialog(Adw.Dialog):
    def __init__(
        self,
        title: str,
        subtitle: str | None,
        submit_label: str,
        on_submit: Callable[[], None],
        cancel_label: str,
        width: int = DIALOG_WIDTH,
        height: int = DIALOG_HEIGHT,
    ) -> None:
        super().__init__(content_width=width, follows_content_size=False, content_height=height)
        self.set_title(title)
        self._fields: dict[str, tuple[Adw.PreferencesRow, Text]] = {}
        self._group_errors: dict[Text, dict[str, str]] = {}
        self._group_labels: dict[Adw.PreferencesGroup, Text] = {}
        self._primary_cb: Callable[[], None] | None = on_submit
        self._secondary_cb: Callable[[], None] | None = self.close

        header = Adw.HeaderBar(title_widget=Adw.WindowTitle(title=title, subtitle=subtitle or ""))
        self._stack = Gtk.Stack(transition_type=Gtk.StackTransitionType.CROSSFADE, vexpand=True)
        self.body = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=18, css_classes=["to-form-body"])
        self._error = Notice("", tone="danger")
        self._error.set_visible(False)
        self.body.append(self._error)
        scroller = Gtk.ScrolledWindow(child=self.body, hscrollbar_policy=Gtk.PolicyType.NEVER, propagate_natural_height=True)
        self._stack.add_named(scroller, FORM_PAGE)

        actions = Gtk.Box(spacing=8, halign=Gtk.Align.END, css_classes=["to-form-actions"])
        self._secondary = ActionButton(cancel_label, lambda: self._secondary_cb and self._secondary_cb(), "flat")
        self._primary = ActionButton(submit_label, self.submit, "primary")
        self._spinner = Adw.Spinner(width_request=16, height_request=16, visible=False)
        actions.append(self._spinner)
        actions.append(self._secondary)
        actions.append(self._primary)
        self.set_default_widget(self._primary)

        view = Adw.ToolbarView(content=self._stack)
        view.add_top_bar(header)
        view.add_bottom_bar(actions)
        self.set_child(view)
        self._busy = False

    def add_group(self, title: str | None = None, description: str | None = None) -> Adw.PreferencesGroup:
        group = Adw.PreferencesGroup(title=title or "", description=description or "")
        errors = Text("", "caption", "danger", wrap=True, lines=None)
        errors.set_visible(False)
        errors.add_css_class("to-form-error")
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        box.append(group)
        box.append(errors)
        self.body.append(box)
        self._group_labels[group] = errors
        self._group_errors[errors] = {}
        return group

    def add_entry(self, group: Adw.PreferencesGroup, key: str, title: str, text: str = "", monospace: bool = False) -> Adw.EntryRow:
        row = Adw.EntryRow(title=title, text=text)
        if monospace:
            row.add_css_class("monospace")
        row.connect("entry-activated", lambda *_: self.submit())
        row.connect("changed", lambda *_: self.set_field_error(key, None))
        group.add(row)
        self._fields[key] = (row, self._group_labels[group])
        return row

    def add_switch(self, group: Adw.PreferencesGroup, title: str, subtitle: str | None = None, active: bool = False) -> Adw.SwitchRow:
        row = Adw.SwitchRow(title=title, subtitle=subtitle or "", active=active)
        group.add(row)
        return row

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
