from collections.abc import Callable, Mapping
from typing import TYPE_CHECKING

from gi.repository import GLib, Gtk

from ...api.errors import describe_error
from ...api.paths import rest
from ...api.tasks import call_on_main
from ...api.types import BuildOutput
from ...widgets.desktop import open_uri
from ...widgets.feedback import EmptyState
from ...widgets.list_view import GroupedList
from ...widgets.record_row import RecordRow, RowAction
from .actions import PROGRESS_STEP
from .download import download_file
from .labels import ARTIFACTS, OUTPUTS
from .model import by_project, file_icon, is_missing, output_folder, output_key, output_meta, safe_file_name

if TYPE_CHECKING:
    from ...context import AppContext


class BuildOutputList(Gtk.Box):
    """Deliverables found in project build folders; each row saves or opens a ticketed download link."""

    def __init__(self, ctx: "AppContext", report: Callable[[str], None]) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self._ctx = ctx
        self._report = report
        self._outputs: list[BuildOutput] = []
        self._names: Mapping[str, str] = {}
        self._downloads: dict[str, float | None] = {}
        self._list = GroupedList(lambda: RecordRow("file", monospace_subtitle=True), self._update, icon="project")
        self._empty = EmptyState(OUTPUTS["empty_title"], OUTPUTS["empty"], "builds")
        self._stack = Gtk.Stack(vhomogeneous=False)
        self._stack.add_named(EmptyState(OUTPUTS["loading"], loading=True), "loading")
        self._stack.add_named(self._empty, "empty")
        self._stack.add_named(self._list, "content")
        self.append(self._stack)

    def render(self, outputs: list[BuildOutput], names: Mapping[str, str], empty: tuple[str, str | None]) -> None:
        self._outputs = outputs
        self._names = names
        self._empty.set_content(*empty, "builds")
        self._rerender()

    def _rerender(self) -> None:
        groups = by_project(self._outputs, self._names)
        self._list.sync([(key, title, [(output_key(o), o) for o in items]) for key, title, items in groups])
        self._stack.set_visible_child_name("content" if self._outputs else "empty")

    def _update(self, row: RecordRow, output: BuildOutput) -> None:
        key = output_key(output)
        row.set_icon(file_icon(output["fileName"]))
        row.set_content(output["fileName"], output_folder(output), output_meta(output))
        downloading = key in self._downloads
        row.set_progress(self._downloads.get(key), downloading)
        row.set_actions([
            RowAction("save", "save", ARTIFACTS["save"], lambda: self._save(output), not downloading),
            RowAction("open", "external", ARTIFACTS["open"], lambda: self._open_link(output)),
        ])

    def _open_link(self, output: BuildOutput) -> None:
        self._ctx.call(
            lambda client: client.build_output_download_url(output["projectId"], output["path"]),
            lambda url: open_uri(self._ctx.window, url, self._report),
            lambda error: self._report(self._describe(output, error)),
        )

    def _save(self, output: BuildOutput) -> None:
        if output_key(output) in self._downloads:
            return
        dialog = Gtk.FileDialog(title=ARTIFACTS["save_title"], initial_name=safe_file_name(output["fileName"]))
        dialog.save(self._ctx.window, None, lambda d, result: self._chosen(d, result, output))

    def _chosen(self, dialog: Gtk.FileDialog, result, output: BuildOutput) -> None:
        try:
            file = dialog.save_finish(result)
        except GLib.Error:
            return
        path = file.get_path() if file else None
        if path:
            self._download(output, path)

    def _download(self, output: BuildOutput, destination: str) -> None:
        key = output_key(output)
        self._downloads[key] = None
        self._rerender()
        last = [0.0]

        def progress(received: int, total: int | None) -> None:
            if not total:
                return
            fraction = received / total
            if fraction - last[0] >= PROGRESS_STEP or received >= total:
                last[0] = fraction
                call_on_main(self._progress, key, fraction)

        def done() -> None:
            self._downloads.pop(key, None)
            self._rerender()

        api_path = rest.build_output_download(output["projectId"], output["path"])
        self._ctx.toast(ARTIFACTS["downloading"].format(name=output["fileName"]))
        self._ctx.call(
            lambda client: download_file(client, api_path, destination, None, progress),
            lambda saved: self._ctx.toast(ARTIFACTS["saved"].format(name=GLib.path_get_basename(saved))),
            lambda error: self._report(ARTIFACTS["failed"].format(error=self._describe(output, error))),
            done,
        )

    def _progress(self, key: str, fraction: float) -> None:
        if key in self._downloads:
            self._downloads[key] = fraction
            row = self._list.widget(key)
            if row is not None:
                row.set_progress(fraction, True)

    def _describe(self, output: BuildOutput, error: BaseException) -> str:
        return OUTPUTS["missing"].format(name=output["fileName"]) if is_missing(error) else describe_error(error)
