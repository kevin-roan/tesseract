from collections.abc import Callable
from typing import Any

from gi.repository import Adw, Gtk

from .buttons import IconButton
from .icon import Icon
from .keyed_list import KeyedList
from .motion import crossfade_stack
from .text import Text


class PillTabs(Gtk.Box):
    """Linear's pill tab strip ("Assigned / Created / Subscribed"); `on_change` fires with the chosen id."""

    def __init__(self, options: list[tuple[str, str]], selected: str, on_change: Callable[[str], None], label: str) -> None:
        super().__init__(spacing=4, css_classes=["to-pill-tabs"], halign=Gtk.Align.START, valign=Gtk.Align.CENTER)
        self.update_property([Gtk.AccessibleProperty.LABEL], [label])
        self._on_change = on_change
        self._selected = selected
        self._buttons: dict[str, Gtk.ToggleButton] = {}
        self._counts: dict[str, Gtk.Label] = {}
        group: Gtk.ToggleButton | None = None
        for option_id, text in options:
            content = Gtk.Box(spacing=6)
            title = Text(text, "label")
            title.remove_css_class("to-fg-text")
            count = Text("", "caption", "textTertiary")
            count.set_visible(False)
            content.append(title)
            content.append(count)
            button = Gtk.ToggleButton(child=content, active=option_id == selected, css_classes=["to-pill-tab"], group=group)
            button.connect("toggled", lambda b, oid=option_id: self._toggled(oid, b.get_active()))
            group = group or button
            self._buttons[option_id] = button
            self._counts[option_id] = count
            self.append(button)

    @property
    def selected(self) -> str:
        return self._selected

    def select(self, option_id: str) -> None:
        button = self._buttons.get(option_id)
        if button is not None:
            button.set_active(True)

    def set_count(self, option_id: str, count: int | None) -> None:
        label = self._counts.get(option_id)
        if label is not None:
            label.set_text_value(str(count) if count else None)

    def _toggled(self, option_id: str, active: bool) -> None:
        if active and option_id != self._selected:
            self._selected = option_id
            self._on_change(option_id)


class ListToolbar(Gtk.Box):
    """The filter bar under a Linear page header: tabs on the left, small flat icon buttons on the right."""

    def __init__(self, start: Gtk.Widget | None = None) -> None:
        super().__init__(spacing=8, css_classes=["to-list-toolbar"])
        self.start = Gtk.Box(spacing=8, hexpand=True, valign=Gtk.Align.CENTER)
        self.end = Gtk.Box(spacing=2, valign=Gtk.Align.CENTER)
        if start is not None:
            self.start.append(start)
        self.append(self.start)
        self.append(self.end)

    def add_start(self, widget: Gtk.Widget) -> Gtk.Widget:
        self.start.append(widget)
        return widget

    def add_end(self, widget: Gtk.Widget) -> Gtk.Widget:
        widget.add_css_class("to-toolbar-button")
        self.end.append(widget)
        return widget


class ToolbarToggle(Gtk.ToggleButton):
    def __init__(self, icon: str, label: str, active: bool, on_toggled: Callable[[bool], None]) -> None:
        super().__init__(child=Icon(icon, "sm"), tooltip_text=label, active=active, css_classes=["flat"], valign=Gtk.Align.CENTER)
        self.update_property([Gtk.AccessibleProperty.LABEL], [label])
        self.connect("toggled", lambda button: on_toggled(button.get_active()))


class GroupHeader(Gtk.Box):
    """Linear's group band: a #1A1A1B bar with an optional status glyph, label, count and a trailing "+"."""

    def __init__(
        self,
        title: str,
        icon: str | None = None,
        icon_color: str | None = None,
        action_label: str | None = None,
        on_action: Callable[[], None] | None = None,
        action_icon: str = "add",
    ) -> None:
        super().__init__(spacing=8, css_classes=["to-group-header"])
        self._icon = Icon(icon or "status-todo", "xs", icon_color or "textSecondary")
        self._icon.set_visible(icon is not None)
        self._title = Text(title, "label")
        self._count = Text("", "body", "textSecondary")
        self._count.set_visible(False)
        self._subtitle = Text("", "caption", "textTertiary")
        self._subtitle.set_hexpand(True)
        self._subtitle.set_visible(False)
        for widget in (self._icon, self._title, self._count):
            self.append(widget)
        self.append(self._subtitle)
        self._spacer = Gtk.Box(hexpand=True)
        self.append(self._spacer)
        self._trailing = Gtk.Box(spacing=4, valign=Gtk.Align.CENTER)
        self.append(self._trailing)
        if action_label and on_action:
            self.add_trailing(IconButton(action_icon, action_label, on_action))

    def set_title(self, title: str) -> None:
        self._title.set_label(title)

    def set_icon(self, icon: str | None, color: str | None = None) -> None:
        self._icon.set_visible(icon is not None)
        if icon:
            self._icon.set_icon(icon)
            self._icon.set_color(color or "textSecondary")

    def set_count(self, count: int | None) -> None:
        self._count.set_text_value(None if count is None else str(count))

    def set_subtitle(self, subtitle: str | None) -> None:
        self._subtitle.set_text_value(subtitle)
        self._spacer.set_visible(not subtitle)

    def add_trailing(self, widget: Gtk.Widget) -> None:
        if isinstance(widget, Gtk.Button):
            widget.add_css_class("to-group-action")
        self._trailing.append(widget)


class ListGroup(Gtk.Box):
    """A group band over flat rows, with loading and empty placeholders in row style."""

    def __init__(
        self,
        title: str,
        child: Gtk.Widget | None = None,
        action_label: str | None = None,
        on_action: Callable[[], None] | None = None,
        empty_label: str | None = None,
        subtitle: str | None = None,
        icon: str | None = None,
        icon_color: str | None = None,
        action_icon: str = "add",
    ) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=2, css_classes=["to-list-group"])
        self.header = GroupHeader(title, icon, icon_color, action_label, on_action, action_icon)
        self.header.set_subtitle(subtitle)
        self.append(self.header)
        self._stack = crossfade_stack(vhomogeneous=False, hhomogeneous=False)
        loading = Gtk.Box(css_classes=["to-list-placeholder"])
        loading.append(Adw.Spinner(width_request=16, height_request=16))
        self._stack.add_named(loading, "loading")
        self._empty = Text(empty_label or "", "body", "textTertiary", wrap=True, lines=None)
        self._empty.add_css_class("to-list-placeholder")
        self._stack.add_named(self._empty, "empty")
        self._content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self._stack.add_named(self._content, "content")
        self._stack.set_visible_child_name("content")
        self.append(self._stack)
        if child is not None:
            self.set_child(child)

    def set_child(self, child: Gtk.Widget) -> None:
        while (existing := self._content.get_first_child()) is not None:
            self._content.remove(existing)
        self._content.append(child)

    def set_count(self, count: int | None) -> None:
        self.header.set_count(count)

    def set_loading(self, loading: bool) -> None:
        if loading:
            self._stack.set_visible_child_name("loading")
        elif self._stack.get_visible_child_name() == "loading":
            self._stack.set_visible_child_name("content")

    def set_empty(self, empty: bool, label: str | None = None) -> None:
        if label is not None:
            self._empty.set_label(label)
        self._stack.set_visible_child_name("empty" if empty else "content")


class HoverRow(Gtk.Overlay):
    """A list row whose quick actions float over its right edge only while hovered or focused, like Linear's."""

    def __init__(self, content: Gtk.Widget) -> None:
        super().__init__(child=content)
        self.hover_actions = Gtk.Box(
            spacing=2, halign=Gtk.Align.END, valign=Gtk.Align.CENTER, css_classes=["to-hover-actions"], visible=False
        )
        self.add_overlay(self.hover_actions)
        self._hovered = self._focused = False
        motion = Gtk.EventControllerMotion()
        motion.connect("enter", lambda *_: self._set_state(hovered=True))
        motion.connect("leave", lambda *_: self._set_state(hovered=False))
        self.add_controller(motion)
        focus = Gtk.EventControllerFocus()
        focus.connect("enter", lambda *_: self._set_state(focused=True))
        focus.connect("leave", lambda *_: self._set_state(focused=False))
        self.add_controller(focus)

    def _set_state(self, hovered: bool | None = None, focused: bool | None = None) -> None:
        if hovered is not None:
            self._hovered = hovered
        if focused is not None:
            self._focused = focused
        self.sync_hover_actions()

    def sync_hover_actions(self) -> None:
        has_actions = self.hover_actions.get_first_child() is not None
        self.hover_actions.set_visible(has_actions and (self._hovered or self._focused))


class PropertyChip(Gtk.Box):
    """A Linear property pill (status, branch, path...): hairline outline, 14px glyph and a 12px label."""

    def __init__(self, icon: str | None = None, label: str = "", icon_color: str | None = None, max_chars: int = -1) -> None:
        super().__init__(spacing=6, valign=Gtk.Align.CENTER, halign=Gtk.Align.START, css_classes=["to-property-chip"])
        self._icon = Icon(icon or "info", "xs", icon_color or "textSecondary")
        self._icon.set_visible(icon is not None)
        self._label = Text(label, "caption", "textSecondary")
        self._label.set_max_width_chars(max_chars)
        self.append(self._icon)
        self.append(self._label)

    def set_label(self, label: str) -> None:
        self._label.set_label(label)
        self._label.set_tooltip_text(label if self._label.get_max_width_chars() > 0 and len(label) > self._label.get_max_width_chars() else None)

    def set_icon(self, icon: str | None, color: str | None = None) -> None:
        self._icon.set_visible(icon is not None)
        if icon:
            self._icon.set_icon(icon)
            self._icon.set_color(color or "textSecondary")

    def update(self, label: str | None, icon: str | None = None, color: str | None = None) -> None:
        self.set_visible(bool(label))
        self.set_label(label or "")
        if icon is not None:
            self.set_icon(icon, color)


class GroupedList(Gtk.Box):
    """Rows bucketed under group bands; `sync` takes (group key, title, [(row key, data)]) in display order."""

    def __init__(
        self,
        create: Callable[[], Gtk.Widget],
        update: Callable[[Gtk.Widget, Any], None],
        icon: str | None = None,
        divided: bool = False,
    ) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        self._create = create
        self._update = update
        self._icon = icon
        self._divided = divided
        self._groups: dict[str, tuple[ListGroup, KeyedList]] = {}
        self._order: list[str] = []

    def widget(self, key: str) -> Gtk.Widget | None:
        return next((found for _group, rows in self._groups.values() if (found := rows.widget(key)) is not None), None)

    def sync(self, groups: list[tuple[str, str, list[tuple[str, Any]]]]) -> None:
        keys = [key for key, _title, _items in groups]
        for stale in [key for key in self._groups if key not in keys]:
            self.remove(self._groups.pop(stale)[0])
        for key, title, items in groups:
            if key not in self._groups:
                rows = KeyedList(self._create, self._update)
                if self._divided:
                    rows.add_css_class("divided")
                self._groups[key] = (ListGroup(title, rows, icon=self._icon), rows)
            group, rows = self._groups[key]
            group.header.set_title(title)
            group.set_count(len(items))
            rows.sync(items)
        if keys != self._order:
            for group, _rows in self._groups.values():
                if group.get_parent() is self:
                    self.remove(group)
            for key in keys:
                self.append(self._groups[key][0])
        self._order = keys
