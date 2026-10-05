from collections.abc import Callable, Mapping
from dataclasses import dataclass

from gi.repository import Adw, Gtk

from ...api.types import AgentRun, InboxItem
from ...util.format import format_relative_time, join_meta
from ...widgets.action_menu import attach_context_menu
from ...widgets.icon import Icon
from ...widgets.text import Text
from . import model
from .labels import ATTENTION, LIST


@dataclass(frozen=True)
class RowModel:
    run_id: str
    state: str
    title: str
    meta: str
    started_at: str
    attention: bool


def row_model(run: AgentRun, names: Mapping[str, str], follow_up: bool, attention: bool) -> RowModel:
    return RowModel(
        run["id"],
        run["state"],
        model.run_title(run.get("prompt")),
        model.row_meta(run, names, LIST["follow_up"] if follow_up else None),
        run.get("startedAt") or "",
        attention,
    )


class StateGlyph(Gtk.Stack):
    def __init__(self, state: str) -> None:
        super().__init__(valign=Gtk.Align.START, hhomogeneous=True, vhomogeneous=True, css_classes=["to-state-glyph"])
        self.add_named(Adw.Spinner(width_request=14, height_request=14), "running")
        for state_id, icon in model.STATE_ICONS.items():
            glyph = Icon(icon, "xs")
            glyph.add_css_class(f"to-state-{state_id}")
            self.add_named(glyph, state_id)
        self.set_state(state)

    def set_state(self, state: str) -> None:
        self.set_visible_child_name(state if state in ("running", *model.STATE_ICONS) else "cancelled")


def _unread_dot() -> Gtk.Widget:
    return Gtk.Box(valign=Gtk.Align.CENTER, css_classes=["to-unread-dot"])


class ConversationRow(Gtk.ListBoxRow):
    def __init__(
        self,
        data: RowModel,
        group_key: str = "",
        on_context: "Callable[[ConversationRow, float, float], None] | None" = None,
    ) -> None:
        super().__init__(css_classes=["to-convo-row"])
        self.data = data
        self.group_key = group_key
        box = Gtk.Box(spacing=10)
        self._glyph = StateGlyph(data.state)
        box.append(self._glyph)
        column = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, hexpand=True)
        top = Gtk.Box(spacing=8)
        title = Text(data.title, "label")
        title.set_hexpand(True)
        top.append(title)
        self._time = Text(format_relative_time(data.started_at), "caption", "textTertiary", xalign=1.0)
        top.append(self._time)
        column.append(top)
        bottom = Gtk.Box(spacing=8)
        meta = Text(data.meta, "caption", "textSecondary")
        meta.set_hexpand(True)
        bottom.append(meta)
        if data.attention:
            bottom.append(_unread_dot())
        column.append(bottom)
        box.append(column)
        self.set_child(box)
        self.set_tooltip_text(data.title)
        if on_context is not None:
            attach_context_menu(self, lambda x, y: on_context(self, x, y))

    def refresh_time(self) -> None:
        self._time.set_label(format_relative_time(self.data.started_at))


class AttentionCard(Gtk.Box):
    def __init__(
        self,
        item: InboxItem,
        project: str | None,
        on_open: Callable[[InboxItem], None] | None,
        open_label: str,
        on_mark_read: Callable[[InboxItem], None],
    ) -> None:
        super().__init__(spacing=10, css_classes=["to-attention-card"])
        glyph, tone = model.notice_style(item)
        icon = Icon(glyph, "xs", tone)
        icon.set_valign(Gtk.Align.START)
        icon.add_css_class("to-state-glyph")
        self.append(icon)
        column = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, hexpand=True)
        top = Gtk.Box(spacing=8)
        title = Text(item["title"], "label")
        title.set_hexpand(True)
        top.append(title)
        top.append(Text(format_relative_time(item.get("updatedAt")), "caption", "textTertiary", xalign=1.0))
        column.append(top)
        meta = Text(join_meta(project, item.get("body") or None), "caption", "textSecondary", wrap=True, lines=2)
        meta.set_visible(bool(meta.get_label()))
        column.append(meta)
        actions = Gtk.Box(spacing=2, margin_top=4)
        if on_open is not None:
            open_button = Gtk.Button(label=open_label, css_classes=["flat", "to-attention-action"])
            open_button.connect("clicked", lambda *_: on_open(item))
            actions.append(open_button)
        mark = Gtk.Button(label=ATTENTION["mark_read"], css_classes=["flat", "to-attention-action"])
        mark.connect("clicked", lambda *_: on_mark_read(item))
        actions.append(mark)
        column.append(actions)
        self.append(column)
        dot = _unread_dot()
        dot.set_valign(Gtk.Align.START)
        dot.add_css_class("top")
        self.append(dot)


class TerminalSessionRow(Gtk.Button):
    def __init__(self, title: str, meta: str, on_activate: Callable[[], None]) -> None:
        super().__init__(css_classes=["flat", "to-terminal-session"])
        box = Gtk.Box(spacing=10)
        glyph = Icon("terminal", "xs", "textSecondary")
        glyph.set_valign(Gtk.Align.START)
        glyph.add_css_class("to-state-glyph")
        box.append(glyph)
        column = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, hexpand=True)
        column.append(Text(title, "label"))
        column.append(Text(meta, "caption", "textSecondary"))
        box.append(column)
        self.set_child(box)
        self.set_tooltip_text(title)
        self.connect("clicked", lambda *_: on_activate())
