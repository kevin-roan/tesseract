from collections.abc import Callable

from gi.repository import Adw, Gtk, Pango

from ..strings import DIALOG
from .buttons import ActionButton, ButtonVariant, IconButton
from .icon import Icon
from .text import Text

DIALOG_WIDTH = 520


class Breadcrumb(Gtk.Box):
    """`[icon] Context › Title`: the context sits in a small chip, like Linear's modal headers."""

    def __init__(self, title: str, context: str | None = None, icon: str | None = None) -> None:
        super().__init__(spacing=6, valign=Gtk.Align.CENTER, css_classes=["to-breadcrumb"])
        self._chip = Gtk.Box(spacing=6, valign=Gtk.Align.CENTER, css_classes=["to-breadcrumb-chip"])
        self._icon = Icon(icon or "sandbox", "xs", "textSecondary")
        self._context = Text("", "bodyStrong", "textSecondary")
        self._chip.append(self._icon)
        self._chip.append(self._context)
        self._caret = Icon("caret-right", "xs", "textTertiary")
        self._title = Text(title, "bodyStrong")
        self.append(self._chip)
        self.append(self._caret)
        self.append(self._title)
        self.set_context(context, icon)

    def set_title(self, title: str) -> None:
        self._title.set_label(title)

    def set_context(self, context: str | None, icon: str | None = None) -> None:
        self._context.set_label(context or "")
        self._icon.set_visible(icon is not None)
        if icon:
            self._icon.set_icon(icon)
        self._chip.set_visible(bool(context))
        self._caret.set_visible(bool(context))


class DialogHeader(Gtk.Box):
    def __init__(
        self,
        title: str,
        context: str | None = None,
        icon: str | None = None,
        on_close: Callable[[], None] | None = None,
        on_expand: Callable[[], None] | None = None,
    ) -> None:
        super().__init__(spacing=4, css_classes=["to-dialog-header"])
        self.breadcrumb = Breadcrumb(title, context, icon)
        self.breadcrumb.set_hexpand(True)
        self.append(self.breadcrumb)
        self._trailing = Gtk.Box(spacing=4, valign=Gtk.Align.CENTER)
        self.append(self._trailing)
        if on_expand:
            self._trailing.append(_header_button("fullscreen", DIALOG["expand"], on_expand))
        if on_close:
            self._trailing.append(_header_button("close", DIALOG["close"], on_close))

    def add_trailing(self, widget: Gtk.Widget) -> None:
        self._trailing.prepend(widget)


def _header_button(icon: str, label: str, on_activate: Callable[[], None]) -> IconButton:
    button = IconButton(icon, label, on_activate)
    button.add_css_class("to-dialog-icon-button")
    return button


class DialogShell(Adw.Dialog):
    """Linear-style modal: breadcrumb header with a close button, a 13px body and a footer
    with secondary actions on the left and the indigo pill on the right."""

    def __init__(
        self,
        title: str,
        context: str | None = None,
        icon: str | None = None,
        width: int = DIALOG_WIDTH,
        height: int | None = None,
        on_expand: Callable[[], None] | None = None,
    ) -> None:
        super().__init__(title=title, content_width=width)
        if height:
            self.set_content_height(height)
        self.add_css_class("to-dialog")
        self.header = DialogHeader(title, context, icon, self.close, on_expand)
        self.body = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12, css_classes=["to-dialog-body"])
        self.scroller = Gtk.ScrolledWindow(
            child=self.body, hscrollbar_policy=Gtk.PolicyType.NEVER, propagate_natural_height=True
        )
        self.footer = Gtk.Box(spacing=8, css_classes=["to-dialog-footer"])
        self.footer_start = Gtk.Box(spacing=8, hexpand=True, halign=Gtk.Align.START, valign=Gtk.Align.CENTER)
        self.footer_end = Gtk.Box(spacing=8, halign=Gtk.Align.END, valign=Gtk.Align.CENTER)
        self.footer.append(self.footer_start)
        self.footer.append(self.footer_end)
        self._content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self._content.append(self.scroller)
        root = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        root.append(self.header)
        root.append(self._content)
        root.append(self.footer)
        self.toasts = Adw.ToastOverlay(child=root)
        self.set_child(self.toasts)

    def set_heading(self, title: str, context: str | None = None, icon: str | None = None) -> None:
        self.set_title(title)
        self.header.breadcrumb.set_title(title)
        if context is not None:
            self.header.breadcrumb.set_context(context, icon)

    def set_content(self, widget: Gtk.Widget) -> None:
        while (child := self._content.get_first_child()) is not None:
            self._content.remove(child)
        widget.set_vexpand(True)
        self._content.append(widget)

    def add_action(
        self,
        label: str,
        on_activate: Callable[[], None] | None = None,
        variant: ButtonVariant = "flat",
        icon: str | None = None,
        start: bool = False,
    ) -> ActionButton:
        button = ActionButton(label, on_activate, variant, icon)
        (self.footer_start if start else self.footer_end).append(button)
        if variant == "primary":
            self.set_default_widget(button)
        return button

    def add_toast(self, toast: Adw.Toast) -> None:
        self.toasts.add_toast(toast)


class TitleEntry(Gtk.Entry):
    """The large borderless title input of Linear's modals ("Issue title")."""

    def __init__(self, placeholder: str, text: str = "", monospace: bool = False) -> None:
        super().__init__(placeholder_text=placeholder, text=text, hexpand=True, css_classes=["to-title-entry"])
        if monospace:
            self.add_css_class("monospace")


class CopyField(Gtk.Box):
    """A read-only monospace value in a hairline field with an inline copy button."""

    def __init__(self, text: str = "", on_copy: Callable[[str], None] | None = None, label: str | None = None) -> None:
        super().__init__(spacing=4, css_classes=["to-copy-field"])
        self._value = Text(text, "code", "textSecondary", selectable=True)
        self._value.set_hexpand(True)
        self._value.set_ellipsize(Pango.EllipsizeMode.MIDDLE)
        self._value.set_valign(Gtk.Align.CENTER)
        self._copy = IconButton("copy", label or DIALOG["copy"], lambda: on_copy and on_copy(self.text))
        self._copy.add_css_class("to-dialog-icon-button")
        self.append(self._value)
        self.append(self._copy)

    @property
    def text(self) -> str:
        return self._value.get_label()

    def set_text(self, text: str) -> None:
        self._value.set_label(text)
        self._value.set_tooltip_text(text or None)


class PropertyChips(Gtk.Box):
    """The row of property pills under a modal's inputs (Backlog / Priority / Assignee …)."""

    def __init__(self) -> None:
        super().__init__(spacing=6, css_classes=["to-property-chips"])

    def add(self, widget: Gtk.Widget) -> Gtk.Widget:
        self.append(widget)
        return widget
