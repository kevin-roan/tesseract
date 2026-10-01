from collections.abc import Callable

from gi.repository import Adw, Gtk

from ...widgets.choice_dropdown import ChoiceDropdown, Option
from ...widgets.composer import Composer
from ...widgets.feedback import Notice
from ...widgets.icon import Icon, IconBadge
from ...widgets.text import Text
from .labels import NEW, SUGGESTIONS

MAX_WIDTH = 720


class NewConversationView(Gtk.ScrolledWindow):
    def __init__(self, on_submit: Callable[[str, str | None], None]) -> None:
        super().__init__(hscrollbar_policy=Gtk.PolicyType.NEVER, vexpand=True, hexpand=True)
        self._on_submit = on_submit
        column = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=20, valign=Gtk.Align.CENTER, css_classes=["to-new-convo"])

        hero = IconBadge("agents", "xl", css_class="to-agents-hero")
        hero.set_halign(Gtk.Align.CENTER)
        column.append(hero)
        titles = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        titles.append(Text(NEW["title"], "h2", center=True))
        subtitle = Text(NEW["subtitle"], "body", "textSecondary", wrap=True, lines=None, center=True)
        titles.append(subtitle)
        column.append(titles)

        self._composer = Composer(NEW["placeholder"], NEW["send"], self._submit, min_height=72, max_height=320, large=True)
        project = Gtk.Box(spacing=4, css_classes=["to-project-picker"])
        project.append(Icon("project", "sm", "textSecondary"))
        self._projects = ChoiceDropdown([], tooltip=NEW["project"])
        project.append(self._projects)
        self._composer.add_accessory(project)
        prompt_group = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        prompt_group.append(self._composer)
        prompt_group.append(Text(NEW["hint"], "caption", "textTertiary", center=True))
        column.append(prompt_group)

        self._error = Notice("", tone="danger")
        self._error.set_visible(False)
        column.append(self._error)

        suggestions = Gtk.FlowBox(
            selection_mode=Gtk.SelectionMode.NONE, column_spacing=8, row_spacing=8, max_children_per_line=6,
            halign=Gtk.Align.CENTER, homogeneous=False,
        )
        for label, prompt in SUGGESTIONS:
            button = Gtk.Button(css_classes=["to-chip", "to-suggestion"])
            button.set_child(Text(label, "label", "textSecondary"))
            button.set_tooltip_text(prompt)
            button.connect("clicked", lambda *_, p=prompt: self._suggest(p))
            suggestions.append(Gtk.FlowBoxChild(child=button, focusable=False))
        column.append(suggestions)

        clamp = Adw.Clamp(maximum_size=MAX_WIDTH, tightening_threshold=MAX_WIDTH, child=column, valign=Gtk.Align.CENTER)
        self.set_child(clamp)

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
        self.set_error(None)

    def _submit(self, prompt: str) -> None:
        self._on_submit(prompt, self.project_id)

    def _suggest(self, prompt: str) -> None:
        self._composer.set_text(prompt)
        self._composer.focus_input()
