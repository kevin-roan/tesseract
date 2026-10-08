from collections.abc import Callable
from typing import TYPE_CHECKING

from gi.repository import Adw, Gtk

from ...attachments.controller import ComposerAttachments
from ...widgets.buttons import IconButton
from ...widgets.choice_dropdown import ChoiceDropdown, Option
from ...widgets.composer import Composer
from ...widgets.conversation import PaneBar
from ...widgets.feedback import Notice
from ...widgets.icon import Icon
from ...widgets.text import Text
from .labels import NEW, SUGGESTIONS, TITLE

if TYPE_CHECKING:
    from ...context import AppContext

SubmitHandler = Callable[[str, str | None, list[str]], None]


class NewConversationView(Gtk.ScrolledWindow):
    """The "new issue" style prompt: a breadcrumb, a large borderless input, property chips and a primary button."""

    def __init__(self, ctx: "AppContext", on_submit: SubmitHandler, on_close: Callable[[], None]) -> None:
        super().__init__(hscrollbar_policy=Gtk.PolicyType.NEVER, vexpand=True, hexpand=True)
        self._on_submit = on_submit
        column = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12, css_classes=["to-new-convo"])

        card = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, css_classes=["to-new-convo-card"])
        header = PaneBar()
        crumb = Gtk.Box(spacing=6, css_classes=["to-breadcrumb-chip"])
        crumb.append(Icon("agents", "xs", "textSecondary"))
        crumb.append(Text(TITLE, "caption", "textSecondary"))
        header.start.append(crumb)
        header.start.append(Icon("caret-right", "xs", "textTertiary"))
        header.start.append(Text(NEW["title"], "label"))
        header.end.append(IconButton("close", NEW["close"], on_close))
        card.append(header)

        self._composer = Composer(NEW["placeholder"], NEW["send"], self._submit, min_height=72, max_height=320, large=True)
        project = Gtk.Box(spacing=2, css_classes=["to-project-picker"])
        project.append(Icon("project", "xs", "textSecondary"))
        self._projects = ChoiceDropdown([], tooltip=NEW["project"])
        project.append(self._projects)
        self._composer.add_property(project)
        self._attachments = ComposerAttachments(ctx, self._composer, self._composer.input, self._attachments_changed)
        self._composer.prepend_accessory(self._attachments.button)
        self._composer.set_tray(self._attachments.tray)
        card.append(self._composer)
        column.append(card)

        self._error = Notice("", tone="danger")
        self._error.set_visible(False)
        column.append(self._error)

        suggestions = Adw.WrapBox(child_spacing=6, line_spacing=6, css_classes=["to-suggestions"])
        for label, prompt in SUGGESTIONS:
            button = Gtk.Button(css_classes=["to-chip", "to-suggestion"])
            button.set_child(Text(label, "caption", "textSecondary"))
            button.set_tooltip_text(prompt)
            button.connect("clicked", lambda *_, p=prompt: self._suggest(p))
            suggestions.append(button)
        column.append(suggestions)

        column.set_valign(Gtk.Align.START)
        self.set_child(column)

    @property
    def project_id(self) -> str | None:
        return self._projects.selected_id or None

    def set_projects(self, options: list[Option]) -> None:
        self._projects.set_options(options)

    def select_project(self, project_id: str | None) -> None:
        self._projects.select(project_id or "")

    def set_prompt(self, prompt: str) -> None:
        self._composer.set_text(prompt)

    def focus(self) -> None:
        self._composer.focus_input()

    def set_busy(self, busy: bool) -> None:
        self._composer.set_busy(busy)

    def set_error(self, message: str | None) -> None:
        self._error.set_visible(bool(message))
        if message:
            self._error.update(message)

    def sent(self) -> None:
        self._composer.clear()
        self._attachments.clear()
        self.set_error(None)

    def _submit(self, prompt: str) -> None:
        self._on_submit(self._attachments.prompt(prompt), self.project_id, self._attachments.upload_ids)

    def _attachments_changed(self) -> None:
        self._composer.set_attachments(self._attachments.has_items, self._attachments.blocked)

    def _suggest(self, prompt: str) -> None:
        self._composer.set_text(prompt)
        self._composer.focus_input()
