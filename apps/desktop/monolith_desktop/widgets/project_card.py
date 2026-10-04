from collections.abc import Callable
from typing import TYPE_CHECKING

from gi.repository import Adw, Gtk

from .badges import StatusBadge
from .buttons import IconButton
from .icon import Icon, IconBadge
from .surface import Pressable, Surface
from .text import Text

if TYPE_CHECKING:
    from ..pages.projects.model import ProjectCardModel

CARD_MIN_WIDTH = 260


class ProjectCard(Gtk.Overlay):
    def __init__(self, on_open: Callable[[str], None], on_ask: Callable[[str], None], ask_label: str) -> None:
        super().__init__(css_classes=["to-project-card"])
        self.set_size_request(CARD_MIN_WIDTH, -1)
        self._id = ""
        self._ask_label = ask_label
        surface = Surface(spacing=12)
        surface.add_css_class("to-project-surface")

        top = Gtk.Box(spacing=12)
        self._badge = IconBadge("project", "md", large=True)
        self._badge.set_hexpand(False)
        titles = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, hexpand=True, valign=Gtk.Align.CENTER)
        self._title = Text("", "h4")
        self._subtitle = Text("", "caption", "textSecondary")
        titles.append(self._title)
        titles.append(self._subtitle)
        top.append(self._badge)
        top.append(titles)
        top.append(Gtk.Box(width_request=36))
        surface.append(top)

        self._badges = Adw.WrapBox(child_spacing=6, line_spacing=6)
        self._activity = StatusBadge("")
        self._branch = StatusBadge("", icon="branch")
        self._sync = StatusBadge("", "info")
        self._dirty = StatusBadge("")
        self._confidential = StatusBadge("", icon="confidential")
        for badge in (self._confidential, self._activity, self._branch, self._sync, self._dirty):
            self._badges.append(badge)
        surface.append(self._badges)

        commit = Gtk.Box(spacing=8)
        commit.add_css_class("to-project-commit")
        commit.append(Icon("commit", "xs", "textTertiary"))
        self._commit = Text("", "bodySmall", "textSecondary")
        self._commit.set_hexpand(True)
        self._when = Text("", "caption", "textTertiary")
        commit.append(self._commit)
        commit.append(self._when)
        self._commit_row = commit
        surface.append(commit)

        self._tags = Adw.WrapBox(child_spacing=6, line_spacing=6)
        surface.append(self._tags)

        self._pressable = Pressable(surface, lambda: on_open(self._id))
        self.set_child(self._pressable)
        self._ask = IconButton("agents", ask_label, lambda: on_ask(self._id))
        self._ask.add_css_class("to-project-ask")
        self._ask.set_halign(Gtk.Align.END)
        self._ask.set_valign(Gtk.Align.START)
        self._ask.set_margin_top(14)
        self._ask.set_margin_end(14)
        self.add_overlay(self._ask)

    def update(self, card: "ProjectCardModel") -> None:
        self._id = card.id
        self._title.set_label(card.title)
        self._subtitle.set_text_value(card.subtitle)
        self._pressable.set_tooltip_text(card.title)
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
        self._commit.set_tooltip_text(card.commit)
        self._when.set_text_value(card.commit_when)
        self._commit_row.set_visible(bool(card.commit))
        while (child := self._tags.get_first_child()) is not None:
            self._tags.remove(child)
        for tag in card.tags:
            label = Text(tag, "caption", "textSecondary")
            label.add_css_class("to-project-tag")
            self._tags.append(label)
        self._tags.set_visible(bool(card.tags))
