from typing import TYPE_CHECKING, Any

from gi.repository import Gdk, Gtk, Pango

from ..api.types import Project
from ..attachments.controller import ComposerAttachments
from ..store import ConnectionState
from ..strings import COMPOSER
from ..theme.tokens import COMPOSER_MAX_HEIGHT
from .icon import Icon
from .text import Text

if TYPE_CHECKING:
    from ..context import AppContext

PROJECT_LABEL_CHARS = 18
PROJECT_LIST_CHARS = 32
INPUT_INSET = (4, 2)
SEND_ICON = "send"
SEND_KEYS = (Gdk.KEY_Return, Gdk.KEY_KP_Enter, Gdk.KEY_ISO_Enter)


def composer_params(text: str, project_id: str | None, attachment_ids: list[str] | None = None) -> dict[str, Any] | None:
    prompt = text.strip()
    if not prompt:
        return None
    params: dict[str, Any] = {"prompt": prompt, "send": True}
    if project_id:
        params["projectId"] = project_id
    if attachment_ids:
        params["attachmentIds"] = list(attachment_ids)
    return params


def _label_factory(max_chars: int) -> Gtk.SignalListItemFactory:
    factory = Gtk.SignalListItemFactory()

    def setup(_factory, item) -> None:
        label = Gtk.Label(xalign=0, ellipsize=Pango.EllipsizeMode.END, max_width_chars=max_chars)
        label.add_css_class("to-text-label")
        item.set_child(label)

    def bind(_factory, item) -> None:
        item.get_child().set_label(item.get_item().get_string())

    factory.connect("setup", setup)
    factory.connect("bind", bind)
    return factory


class ProjectPicker(Gtk.DropDown):
    def __init__(self) -> None:
        self._names = Gtk.StringList.new([COMPOSER["no_project"]])
        super().__init__(model=self._names, css_classes=["to-composer-project"], valign=Gtk.Align.CENTER)
        self._ids: list[str | None] = [None]
        self.set_factory(_label_factory(PROJECT_LABEL_CHARS))
        self.set_list_factory(_label_factory(PROJECT_LIST_CHARS))
        self.set_tooltip_text(COMPOSER["project_tooltip"])

    @property
    def project_id(self) -> str | None:
        index = self.get_selected()
        return self._ids[index] if 0 <= index < len(self._ids) else None

    def set_projects(self, projects: list[Project] | None) -> None:
        current = self.project_id
        ordered = sorted(projects or [], key=lambda project: (project.get("name") or project["id"]).lower())
        ids = [None, *(project["id"] for project in ordered)]
        if ids == self._ids:
            return
        self._ids = ids
        names = [COMPOSER["no_project"], *((project.get("name") or project["id"]) for project in ordered)]
        self._names.splice(0, self._names.get_n_items(), names)
        self.select(current)

    def select(self, project_id: str | None) -> None:
        self.set_selected(self._ids.index(project_id) if project_id in self._ids else 0)


class SidebarComposer(Gtk.Box):
    def __init__(self, ctx: "AppContext") -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=4, css_classes=["to-composer", "to-side-composer"])
        self._ctx = ctx
        self._online = False

        self._view = Gtk.TextView(
            wrap_mode=Gtk.WrapMode.WORD_CHAR,
            accepts_tab=False,
            hexpand=True,
            top_margin=INPUT_INSET[0],
            bottom_margin=INPUT_INSET[0],
            left_margin=INPUT_INSET[1],
            right_margin=INPUT_INSET[1],
        )
        self._view.add_css_class("to-composer-input")
        self._buffer = self._view.get_buffer()
        self._placeholder = Text(COMPOSER["placeholder"], "body", "textTertiary")
        self._placeholder.set_can_target(False)
        self._placeholder.set_valign(Gtk.Align.START)
        self._placeholder.set_halign(Gtk.Align.START)
        self._placeholder.set_margin_top(INPUT_INSET[0])
        self._placeholder.set_margin_start(INPUT_INSET[1])
        scroller = Gtk.ScrolledWindow(
            child=self._view,
            hscrollbar_policy=Gtk.PolicyType.NEVER,
            propagate_natural_height=True,
            max_content_height=COMPOSER_MAX_HEIGHT,
        )
        overlay = Gtk.Overlay(child=scroller)
        overlay.add_overlay(self._placeholder)
        self._attachments = ComposerAttachments(ctx, self, self._view, self._sync)
        self.append(self._attachments.tray)
        self.append(overlay)

        self._picker = ProjectPicker()
        self._send = Gtk.Button(
            child=Icon(SEND_ICON, "xs"), css_classes=["to-composer-send"], valign=Gtk.Align.CENTER, tooltip_text=COMPOSER["send"]
        )
        self._send.update_property([Gtk.AccessibleProperty.LABEL], [COMPOSER["send"]])
        footer = Gtk.Box(spacing=2)
        footer.append(self._attachments.button)
        footer.append(self._picker)
        footer.append(Gtk.Box(hexpand=True))
        footer.append(self._send)
        self.append(footer)

        keys = Gtk.EventControllerKey()
        keys.connect("key-pressed", self._on_key)
        self._view.add_controller(keys)
        self._buffer.connect("changed", lambda *_: self._sync())
        self._send.connect("clicked", lambda *_: self.send())
        ctx.store.projects.bind(self, self._picker.set_projects)
        ctx.store.connection.bind(self, self._on_connection)

    @property
    def text(self) -> str:
        start, end = self._buffer.get_bounds()
        return self._buffer.get_text(start, end, False)

    def select_project(self, project_id: str | None) -> None:
        self._picker.select(project_id)

    def focus(self) -> None:
        self._view.grab_focus()

    def send(self) -> bool:
        if self._attachments.blocked:
            return False
        prompt = self._attachments.prompt(self.text) if self._attachments.has_items else self.text
        params = composer_params(prompt, self._picker.project_id, self._attachments.upload_ids)
        if params is None or not self._online:
            return False
        if not self._ctx.navigate("agents", params):
            self._ctx.toast(COMPOSER["unavailable"])
            return False
        self._buffer.set_text("")
        self._attachments.clear()
        return True

    def _on_connection(self, state: ConnectionState) -> None:
        self._online = state.online
        self._sync()

    def _sync(self) -> None:
        has_draft = bool(self.text.strip()) or self._attachments.has_items
        self._placeholder.set_visible(not self.text)
        self._send.set_sensitive(has_draft and self._online and not self._attachments.blocked)
        self._send.set_tooltip_text(COMPOSER["send"] if self._online else COMPOSER["offline"])

    def _on_key(self, _controller, keyval: int, _keycode: int, state: Gdk.ModifierType) -> bool:
        if keyval not in SEND_KEYS or state & Gdk.ModifierType.SHIFT_MASK:
            return False
        self.send()
        return True
