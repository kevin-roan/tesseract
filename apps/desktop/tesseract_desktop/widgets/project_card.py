from collections.abc import Callable, Iterable
from typing import TYPE_CHECKING

from gi.repository import Adw, Gtk

from ..theme.tokens import SPACING
from .badges import StatusBadge
from .buttons import IconButton
from .icon import Icon, IconBadge
from .surface import Pressable, Surface
from .text import Text

if TYPE_CHECKING:
    from ..pages.projects.model import ProjectCardModel


class ProjectCard(Gtk.Overlay):
    def __init__(self, on_open: Callable[[str], None], on_ask: Callable[[str], None], ask_label: str) -> None:
        super().__init__(css_classes=["to-project-card"])
        self._id = ""
        self._ask_label = ask_label
        surface = Surface(spacing=SPACING["md"])
        surface.add_css_class("to-project-surface")

        top = Gtk.Box(spacing=SPACING["md"])
        self._badge = IconBadge("project", "sm", large=True)
        self._badge.set_hexpand(False)
        self._badge.set_vexpand(False)
        titles = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, hexpand=True, valign=Gtk.Align.CENTER)
        self._title = Text("", "h3")
        self._subtitle = Text("", "caption", "textTertiary")
        for label in (self._title, self._subtitle):
            label.set_max_width_chars(1)
        titles.append(self._title)
        titles.append(self._subtitle)
        top.append(self._badge)
        top.append(titles)
        top.append(Gtk.Box(css_classes=["to-project-ask-space"]))
        surface.append(top)

        self._badges = Adw.WrapBox(child_spacing=SPACING["xs"] + 2, line_spacing=SPACING["xs"] + 2, natural_line_length=0)
        self._confidential = StatusBadge("", icon="confidential")
        self._activity = StatusBadge("")
        self._branch = StatusBadge("", icon="branch")
        self._sync = StatusBadge("", icon="sync")
        self._dirty = StatusBadge("")
        for badge in (self._confidential, self._activity, self._branch, self._sync, self._dirty):
            self._badges.append(badge)
        surface.append(self._badges)

        surface.append(Gtk.Box(vexpand=True))
        self._commit_row = Gtk.Box(spacing=SPACING["sm"], css_classes=["to-project-commit"])
        self._commit_row.append(Icon("commit", "xs", "textTertiary"))
        self._commit = Text("", "body", "textSecondary")
        self._commit.set_hexpand(True)
        self._commit.set_max_width_chars(1)
        self._when = Text("", "caption", "textTertiary")
        self._commit_row.append(self._commit)
        self._commit_row.append(self._when)
        surface.append(self._commit_row)

        self._tags = Adw.WrapBox(child_spacing=SPACING["xs"] + 2, line_spacing=SPACING["xs"] + 2, natural_line_length=0)
        surface.append(self._tags)

        self._pressable = Pressable(surface, lambda: on_open(self._id))
        self.set_child(self._pressable)
        self._ask = IconButton("agents", ask_label, lambda: on_ask(self._id))
        self._ask.add_css_class("to-project-ask")
        self._ask.set_halign(Gtk.Align.END)
        self._ask.set_valign(Gtk.Align.START)
        self.add_overlay(self._ask)

    def update(self, card: "ProjectCardModel") -> None:
        self._id = card.id
        self._title.set_label(card.title)
        self._subtitle.set_text_value(card.subtitle)
        self._pressable.update_property([Gtk.AccessibleProperty.LABEL], [card.title])
        self._ask.set_tooltip_text(self._ask_label.format(name=card.title))
        self._confidential.set_visible(card.confidential is not None)
        if card.confidential:
            self._confidential.update(*card.confidential)
        self._activity.update(card.activity.label, card.activity.tone)
        self._branch.set_label(card.branch or "")
        self._branch.set_visible(bool(card.branch))
        self._sync.set_label(card.sync or "")
        self._sync.set_visible(bool(card.sync))
        self._dirty.set_visible(card.dirty is not None)
        if card.dirty:
            self._dirty.update(*card.dirty)
        self._commit.set_label(card.commit or "")
        self._when.set_text_value(card.commit_when)
        self._commit_row.set_visible(bool(card.commit))
        while (child := self._tags.get_first_child()) is not None:
            self._tags.remove(child)
        for tag in card.tags:
            label = Text(tag, "caption", "textSecondary")
            label.add_css_class("to-project-tag")
            self._tags.append(label)
        self._tags.set_visible(bool(card.tags))


class ProjectGrid(Gtk.FlowBox):
    """Responsive card grid keyed by project id: as many columns (up to max_columns) as the card min-width allows."""

    def __init__(self, create: Callable[[], ProjectCard], max_columns: int = 3) -> None:
        super().__init__(
            selection_mode=Gtk.SelectionMode.NONE,
            homogeneous=True,
            min_children_per_line=1,
            max_children_per_line=max_columns,
            column_spacing=SPACING["md"],
            row_spacing=SPACING["md"],
            valign=Gtk.Align.START,
            css_classes=["to-project-grid"],
        )
        self._create = create
        self._children: dict[str, Gtk.FlowBoxChild] = {}
        self._order: list[str] = []

    def sync(self, cards: Iterable["ProjectCardModel"]) -> None:
        items = list(cards)
        keys = [card.id for card in items]
        for stale in [key for key in self._children if key not in keys]:
            self.remove(self._children.pop(stale))
        for card in items:
            child = self._children.get(card.id)
            if child is None:
                child = Gtk.FlowBoxChild(child=self._create(), focusable=False)
                self._children[card.id] = child
            child.get_child().update(card)
        if keys != self._order:
            for child in self._children.values():
                if child.get_parent() is self:
                    self.remove(child)
            for key in keys:
                self.append(self._children[key])
        self._order = keys
        self.set_visible(bool(keys))
