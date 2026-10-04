from gi.repository import Adw, GLib, Gtk, Pango

from ..theme.tone import Tone
from .buttons import IconButton
from .icon import Icon
from .markdown import MarkdownView
from .motion import revealer
from .text import Text
from .tone import ToneBinding

FOLLOW_THRESHOLD_PX = 48
TIMELINE_WIDTH = 820
BUBBLE_CHARS = 64


class UserBubble(Gtk.Box):
    def __init__(self, text: str) -> None:
        super().__init__(halign=Gtk.Align.END, css_classes=["to-bubble-user"])
        self._label = Text(text, "body", "bubbleUserText", wrap=True, lines=None, selectable=True)
        self._label.set_max_width_chars(BUBBLE_CHARS)
        self._label.set_focusable(False)
        self.append(self._label)

    def set_text(self, text: str) -> None:
        self._label.set_label(text)


class AssistantMessage(Gtk.Box):
    def __init__(self, text: str, icon: str = "agents", copy_label: str = "Copy", copied_label: str = "Copied") -> None:
        super().__init__(spacing=12, css_classes=["to-assistant-message"])
        avatar = Gtk.Box(valign=Gtk.Align.START, halign=Gtk.Align.START, css_classes=["to-assistant-avatar"])
        mark = Icon(icon, "sm")
        mark.set_halign(Gtk.Align.CENTER)
        mark.set_valign(Gtk.Align.CENTER)
        avatar.append(mark)
        self.append(avatar)
        self._body = MarkdownView(text, copy_label=copy_label, copied_label=copied_label)
        self._body.set_hexpand(True)
        self.append(self._body)

    def set_text(self, text: str) -> None:
        self._body.set_markdown(text)


class ToolCallCard(Gtk.Box):
    def __init__(self, tool: str, summary: str, result: str | None, status: str, labels: dict[str, str]) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, css_classes=["to-tool-card"])
        self._labels = labels
        header = Gtk.Button(css_classes=["flat", "to-tool-header"])
        row = Gtk.Box(spacing=8)
        self._chevron = Icon("collapse", "xs", "textTertiary")
        row.append(self._chevron)
        row.append(Icon("tool", "xs", "accentStrong"))
        self._name = Text(tool, "label")
        row.append(self._name)
        self._summary = Text(summary, "code", "textSecondary")
        self._summary.set_hexpand(True)
        self._summary.set_ellipsize(Pango.EllipsizeMode.END)
        row.append(self._summary)
        self._status = Gtk.Stack(hhomogeneous=False, vhomogeneous=False)
        self._status.add_named(Adw.Spinner(width_request=14, height_request=14), "pending")
        self._status.add_named(Icon("success", "xs", "success"), "ok")
        self._status.add_named(Icon("close", "xs", "danger"), "error")
        self._status.add_named(Gtk.Box(), "unknown")
        row.append(self._status)
        header.set_child(row)
        header.connect("clicked", lambda *_: self.set_expanded(not self._revealer.get_reveal_child()))
        self.append(header)

        details = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6, css_classes=["to-tool-details"])
        self._input_title = Text(labels["input"], "overline", "textTertiary")
        self._input = Text("", "code", "text", wrap=True, lines=None, selectable=True)
        self._result_title = Text(labels["output"], "overline", "textTertiary")
        self._result = Text("", "code", "textSecondary", wrap=True, lines=None, selectable=True)
        for widget in (self._input_title, self._input, self._result_title, self._result):
            if isinstance(widget, Gtk.Label):
                widget.set_focusable(False)
            details.append(widget)
        self._revealer = revealer(child=details, transition_type=Gtk.RevealerTransitionType.SLIDE_DOWN)
        self.append(self._revealer)
        self.update(tool, summary, result, status)

    def set_expanded(self, expanded: bool) -> None:
        self._revealer.set_reveal_child(expanded)
        self._chevron.set_icon("expand" if expanded else "collapse")

    def update(self, tool: str, summary: str, result: str | None, status: str) -> None:
        self._name.set_text_value(tool)
        self._summary.set_label((summary or result or "").splitlines()[0] if (summary or result) else "")
        self._input.set_label(summary)
        self._input.set_visible(bool(summary))
        self._input_title.set_visible(bool(summary))
        self._result.set_label(result or "")
        self._result.set_visible(bool(result))
        self._result_title.set_visible(bool(result))
        self._result.set_color("danger" if status == "error" else "textSecondary")
        self._status.set_visible_child_name(status if status in ("pending", "ok", "error") else "unknown")
        if status == "error":
            self.add_css_class("error")
        else:
            self.remove_css_class("error")


class SystemLine(Gtk.Box):
    def __init__(self, text: str) -> None:
        super().__init__(halign=Gtk.Align.CENTER, css_classes=["to-system-line"])
        self._label = Text(text, "caption", "textTertiary", wrap=True, lines=None, selectable=True, center=True)
        self._label.set_focusable(False)
        self.append(self._label)

    def set_text(self, text: str) -> None:
        self._label.set_label(text)


class OutcomeCard(Gtk.Box):
    def __init__(self, title: str, meta: str | None, tone: Tone, icon: str, body: str | None = None, error: str | None = None) -> None:
        super().__init__(spacing=12, css_classes=["to-outcome", "to-tone-bg"])
        self._icon = Icon(icon, "md")
        self._icon.add_css_class("to-tone-fg")
        self._icon.set_valign(Gtk.Align.START)
        self.append(self._icon)
        column = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4, hexpand=True)
        heading = Gtk.Box(spacing=8)
        self._title = Text(title, "bodyStrong")
        self._title.add_css_class("to-tone-fg")
        heading.append(self._title)
        self._meta = Text(meta or "", "caption", "textSecondary", xalign=1.0)
        self._meta.set_hexpand(True)
        heading.append(self._meta)
        column.append(heading)
        self._error = Text("", "bodySmall", wrap=True, lines=None, selectable=True)
        self._error.set_focusable(False)
        column.append(self._error)
        self._body = MarkdownView("")
        column.append(self._body)
        self.append(column)
        self._tone = ToneBinding(tone, self, self._icon, self._title)
        self.update(title, meta, tone, icon, body, error)

    def update(self, title: str, meta: str | None, tone: Tone, icon: str, body: str | None = None, error: str | None = None) -> None:
        self._title.set_label(title)
        self._meta.set_text_value(meta)
        self._tone.set(tone)
        self._icon.set_icon(icon)
        self._error.set_text_value(error)
        self._body.set_markdown(body or "")
        self._body.set_visible(bool(body))


class ThinkingRow(Gtk.Box):
    def __init__(self, label: str) -> None:
        super().__init__(spacing=10, css_classes=["to-thinking"])
        self.append(Adw.Spinner(width_request=16, height_request=16))
        self.append(Text(label, "bodySmall", "textSecondary"))


class TimelineView(Gtk.Overlay):
    def __init__(self, jump_label: str, max_width: int = TIMELINE_WIDTH) -> None:
        super().__init__(vexpand=True, hexpand=True, css_classes=["to-timeline"])
        self._following = True
        self._header = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self._items = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=16)
        self._footer = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
        content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=16, css_classes=["to-timeline-content"])
        for part in (self._header, self._items, self._footer):
            content.append(part)
        clamp = Adw.Clamp(maximum_size=max_width, tightening_threshold=max_width, child=content)
        self._scroller = Gtk.ScrolledWindow(child=clamp, hscrollbar_policy=Gtk.PolicyType.NEVER, vexpand=True)
        self.set_child(self._scroller)
        self._jump = IconButton("down", jump_label, self.jump_to_end, flat=False)
        self._jump.add_css_class("to-jump-button")
        self._jump.set_halign(Gtk.Align.CENTER)
        self._jump.set_valign(Gtk.Align.END)
        self._jump.set_margin_bottom(16)
        self._jump.set_visible(False)
        self.add_overlay(self._jump)
        adjustment = self._scroller.get_vadjustment()
        adjustment.connect("value-changed", self._on_scroll)
        adjustment.connect("changed", self._on_content_changed)

    def append(self, widget: Gtk.Widget) -> None:
        self._items.append(widget)

    def clear(self) -> None:
        while (child := self._items.get_first_child()) is not None:
            self._items.remove(child)
        self._following = True
        self._jump.set_visible(False)

    def set_header(self, widget: Gtk.Widget | None) -> None:
        _replace_children(self._header, widget)

    def set_footer(self, widgets: list[Gtk.Widget]) -> None:
        _replace_children(self._footer, None)
        for widget in widgets:
            self._footer.append(widget)

    def jump_to_end(self) -> None:
        self._following = True
        self._jump.set_visible(False)
        GLib.idle_add(self._scroll_to_end)

    def _scroll_to_end(self) -> bool:
        adjustment = self._scroller.get_vadjustment()
        adjustment.set_value(adjustment.get_upper() - adjustment.get_page_size())
        return GLib.SOURCE_REMOVE

    def _on_scroll(self, adjustment: Gtk.Adjustment) -> None:
        distance = adjustment.get_upper() - adjustment.get_page_size() - adjustment.get_value()
        self._following = distance <= FOLLOW_THRESHOLD_PX
        self._jump.set_visible(not self._following)

    def _on_content_changed(self, adjustment: Gtk.Adjustment) -> None:
        if self._following:
            GLib.idle_add(self._scroll_to_end)
        else:
            self._on_scroll(adjustment)


def _replace_children(box: Gtk.Box, widget: Gtk.Widget | None) -> None:
    while (child := box.get_first_child()) is not None:
        box.remove(child)
    if widget is not None:
        box.append(widget)

