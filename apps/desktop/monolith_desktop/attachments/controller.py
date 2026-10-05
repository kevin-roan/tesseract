import os
from collections.abc import Callable
from typing import TYPE_CHECKING

from gi.repository import Gdk, Gio, GLib, GObject, Gtk

from ..api.errors import describe_error
from ..api.types import Upload
from ..strings import ATTACHMENTS as S
from ..util.format import format_bytes
from ..widgets.icon import Icon
from .model import PNG_MIME_TYPE, DraftAttachment, Drafts, PickedFile, mime_type_of, pasted_image_name, read_file, too_many_message, upload_name
from .widgets import AttachmentChip, AttachmentTray

if TYPE_CHECKING:
    from ..context import AppContext

FILE_ATTRIBUTES = "standard::display-name,standard::size,standard::content-type"


def picked_from(file: Gio.File) -> PickedFile:
    path = file.get_path()
    name = os.path.basename(path) if path else (file.get_basename() or "file")
    size: int | None = None
    hint: str | None = None
    try:
        info = file.query_info(FILE_ATTRIBUTES, Gio.FileQueryInfoFlags.NONE, None)
        name = info.get_display_name() or name
        size = info.get_size()
        content_type = info.get_content_type()
        hint = Gio.content_type_get_mime_type(content_type) if content_type else None
    except GLib.Error:
        pass
    return PickedFile(name, mime_type_of(name, hint), size, path=path)


def clipboard_has_image(clipboard: Gdk.Clipboard) -> bool:
    return clipboard.get_formats().contain_gtype(Gdk.Texture)


def clipboard_has_text(clipboard: Gdk.Clipboard) -> bool:
    return clipboard.get_formats().contain_gtype(GObject.TYPE_STRING)


class ComposerAttachments:
    """Attach button, chip tray, paste and drag-and-drop for one composer; uploads each file as soon as it is added.

    The host places `button` and `tray`, sends `upload_ids` with the prompt, and calls `clear()` once the run starts.
    """

    def __init__(self, ctx: "AppContext", anchor: Gtk.Widget, input: Gtk.TextView, on_changed: Callable[[], None]) -> None:
        self._ctx = ctx
        self._anchor = anchor
        self._on_changed = on_changed
        self._drafts = Drafts()
        self._chips: dict[str, AttachmentChip] = {}
        self._enabled = True

        self.tray = AttachmentTray()
        self.button = Gtk.MenuButton(
            child=Icon("attach", "sm"), css_classes=["flat", "circular", "to-composer-attach"], valign=Gtk.Align.CENTER
        )
        self.button.set_tooltip_text(S["attach"])
        self.button.update_property([Gtk.AccessibleProperty.LABEL], [S["attach"]])
        self._menu_actions = Gio.SimpleActionGroup()
        self._paste_action = Gio.SimpleAction.new("paste", None)
        self._paste_action.connect("activate", lambda *_: self.paste_image())
        for name, handler in (("files", lambda *_: self._choose(False)), ("images", lambda *_: self._choose(True))):
            action = Gio.SimpleAction.new(name, None)
            action.connect("activate", handler)
            self._menu_actions.add_action(action)
        self._menu_actions.add_action(self._paste_action)
        self.button.insert_action_group("attach", self._menu_actions)
        menu = Gio.Menu()
        menu.append(S["images"], "attach.images")
        menu.append(S["files"], "attach.files")
        menu.append(S["paste"], "attach.paste")
        self.button.set_menu_model(menu)
        self.button.connect("notify::active", lambda button, _p: button.get_active() and self._refresh_paste())

        input.connect("paste-clipboard", self._on_paste_clipboard)
        drop = Gtk.DropTarget.new(Gdk.FileList, Gdk.DragAction.COPY)
        drop.connect("drop", self._on_drop)
        drop.connect("enter", lambda *_: self._drag_hover(True))
        drop.connect("leave", lambda *_: self._drag_hover(False))
        anchor.add_controller(drop)

    @property
    def items(self) -> list[DraftAttachment]:
        return list(self._drafts.items)

    @property
    def has_items(self) -> bool:
        return bool(self._drafts.items)

    @property
    def upload_ids(self) -> list[str]:
        return self._drafts.upload_ids

    @property
    def blocked(self) -> bool:
        return self._drafts.blocked

    def prompt(self, text: str) -> str:
        return self._drafts.prompt(text)

    def set_enabled(self, enabled: bool) -> None:
        self._enabled = enabled
        self._sync_button()

    def clear(self) -> None:
        self._drafts.clear()
        self._chips = {}
        self.tray.clear()
        self._changed()

    def add(self, files: list[PickedFile]) -> None:
        if not files:
            return
        drafts, rejected = self._drafts.add(files)
        if rejected:
            self._ctx.toast(" ".join(rejected), timeout_s=5)
        for draft in drafts:
            chip = AttachmentChip(
                draft.name,
                draft.kind,
                format_bytes(draft.file.size_bytes) if draft.file.size_bytes is not None else None,
                load_thumbnail=self._local_thumbnail(draft),
                on_remove=lambda key=draft.key: self.remove(key),
                on_retry=lambda key=draft.key: self.retry(key),
            )
            chip.set_status("uploading")
            self._chips[draft.key] = chip
            self.tray.append_chip(chip)
            self._upload(draft)
        self._changed()

    def remove(self, key: str) -> None:
        chip = self._chips.pop(key, None)
        if chip is not None:
            self.tray.remove_chip(chip)
        if self._drafts.remove(key):
            self._changed()

    def retry(self, key: str) -> None:
        draft = self._drafts.patch(key, status="uploading", error=None)
        if draft is not None:
            self._show(draft)
            self._upload(draft)
            self._changed()

    def paste_image(self) -> None:
        if not self._drafts.can_attach:
            self._ctx.toast(too_many_message())
            return
        clipboard = self._anchor.get_clipboard()
        if not clipboard_has_image(clipboard):
            self._ctx.toast(S["empty_clipboard"])
            return
        clipboard.read_texture_async(None, self._texture_read)

    def _texture_read(self, clipboard: Gdk.Clipboard, result: Gio.AsyncResult) -> None:
        try:
            texture = clipboard.read_texture_finish(result)
        except GLib.Error as error:
            self._ctx.toast(S["unreadable"].format(name=S["paste"], error=error.message))
            return
        if texture is None:
            self._ctx.toast(S["empty_clipboard"])
            return
        data = texture.save_to_png_bytes().get_data() or b""
        self.add([PickedFile(pasted_image_name(), PNG_MIME_TYPE, len(data), data=data)])

    def _local_thumbnail(self, draft: DraftAttachment) -> tuple[str, Callable[[], bytes]] | None:
        if draft.kind != "image" or (draft.file.path is None and draft.file.data is None):
            return None
        return draft.key, lambda: read_file(draft.file)

    def _upload(self, draft: DraftAttachment) -> None:
        file = draft.file

        def request(client) -> Upload:
            return client.create_upload(upload_name(file.name), file.mime_type, read_file(file))

        def ok(upload: Upload) -> None:
            if self._drafts.patch(draft.key, status="ready", upload=upload, error=None) is not None:
                self._settled(draft.key)

        def failed(error: BaseException) -> None:
            message = str(error) if isinstance(error, (ValueError, OSError)) else describe_error(error)
            if self._drafts.patch(draft.key, status="error", error=message) is not None:
                self._settled(draft.key)

        self._ctx.call(request, ok, failed)

    def _settled(self, key: str) -> None:
        draft = self._drafts.get(key)
        if draft is not None:
            self._show(draft)
        self._changed()

    def _show(self, draft: DraftAttachment) -> None:
        chip = self._chips.get(draft.key)
        if chip is not None:
            chip.set_status(draft.status, draft.error)

    def _changed(self) -> None:
        self._sync_button()
        self._on_changed()

    def _sync_button(self) -> None:
        self.button.set_sensitive(self._enabled and self._drafts.can_attach)

    def _refresh_paste(self) -> None:
        self._paste_action.set_enabled(clipboard_has_image(self._anchor.get_clipboard()))

    def _choose(self, images_only: bool) -> None:
        if not self._drafts.can_attach:
            self._ctx.toast(too_many_message())
            return
        dialog = Gtk.FileDialog(title=S["images_title" if images_only else "files_title"], modal=True)
        if images_only:
            images = Gtk.FileFilter(name=S["images_filter"])
            images.add_mime_type("image/*")
            filters = Gio.ListStore.new(Gtk.FileFilter)
            filters.append(images)
            dialog.set_filters(filters)
            dialog.set_default_filter(images)
        root = self._anchor.get_root()
        dialog.open_multiple(root if isinstance(root, Gtk.Window) else None, None, self._chosen)

    def _chosen(self, dialog: Gtk.FileDialog, result: Gio.AsyncResult) -> None:
        try:
            files = dialog.open_multiple_finish(result)
        except GLib.Error:
            return
        if files is not None:
            self._add_files([files.get_item(i) for i in range(files.get_n_items())])

    def _add_files(self, files: list[Gio.File]) -> None:
        picked = [picked_from(file) for file in files if file is not None]
        unreadable = [file for file in picked if file.path is None]
        for file in unreadable:
            self._ctx.toast(S["no_path"].format(name=file.name))
        self.add([file for file in picked if file.path is not None])

    def _on_paste_clipboard(self, view: Gtk.TextView) -> None:
        clipboard = view.get_clipboard()
        if self._enabled and clipboard_has_image(clipboard) and not clipboard_has_text(clipboard):
            view.stop_emission_by_name("paste-clipboard")
            self.paste_image()

    def _on_drop(self, _target: Gtk.DropTarget, value: Gdk.FileList, _x: float, _y: float) -> bool:
        self._drag_hover(False)
        if not self._enabled:
            return False
        self._add_files(list(value.get_files()))
        return True

    def _drag_hover(self, hovering: bool) -> Gdk.DragAction:
        if hovering and self._enabled:
            self._anchor.add_css_class("drop-target")
        else:
            self._anchor.remove_css_class("drop-target")
        return Gdk.DragAction.COPY
