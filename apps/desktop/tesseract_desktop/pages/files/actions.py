from collections.abc import Callable
from typing import TYPE_CHECKING

from gi.repository import GLib, Gtk

from ...api.errors import describe_error
from ...api.tasks import call_on_main
from ...api.types import Artifact, TaildropTargets
from ...widgets.confirm_dialog import choose, confirm
from ...widgets.desktop import open_uri
from .download import download_artifact
from .labels import ARTIFACTS, DELETE, TAILDROP
from .model import find_artifact, is_missing, online_targets, safe_file_name, taildrop_available, target_label

if TYPE_CHECKING:
    from ...context import AppContext

PROGRESS_STEP = 0.02


class ArtifactActions:
    def __init__(
        self,
        ctx: "AppContext",
        report: Callable[[str], None],
        on_change: Callable[[], None],
        on_progress: Callable[[str, float], None],
        on_deleted: Callable[[str], None],
    ) -> None:
        self._ctx = ctx
        self._report = report
        self._on_change = on_change
        self._on_progress = on_progress
        self._on_deleted = on_deleted
        self._downloads: dict[str, float | None] = {}
        self._taildrop: TaildropTargets | None = None
        self._taildrop_loading = False

    def downloading(self, artifact_id: str) -> bool:
        return artifact_id in self._downloads

    def progress(self, artifact_id: str) -> float | None:
        return self._downloads.get(artifact_id)

    @property
    def can_send(self) -> bool:
        return taildrop_available(self._taildrop)

    def load_taildrop(self) -> None:
        if self._taildrop_loading:
            return
        self._taildrop_loading = True

        def loaded(taildrop: TaildropTargets) -> None:
            changed = taildrop_available(taildrop) != self.can_send
            self._taildrop = taildrop
            if changed:
                self._on_change()

        def done() -> None:
            self._taildrop_loading = False

        self._ctx.call(lambda client: client.taildrop_targets(), loaded, lambda _error: None, done)

    def save(self, artifact: Artifact) -> None:
        if self.downloading(artifact["id"]):
            return
        dialog = Gtk.FileDialog(title=ARTIFACTS["save_title"], initial_name=safe_file_name(artifact["fileName"]))
        dialog.save(self._ctx.window, None, lambda d, result: self._chosen(d, result, artifact))

    def save_by_id(self, artifact_id: str, project_id: str | None, known: list[Artifact] | None) -> None:
        artifact = find_artifact(known, artifact_id)
        if artifact is not None:
            self.save(artifact)
            return

        def found(artifacts: list[Artifact]) -> None:
            match = find_artifact(artifacts, artifact_id)
            if match is None:
                self._report(ARTIFACTS["missing_unknown"])
            else:
                self.save(match)

        self._ctx.call(lambda client: client.list_artifacts(project_id), found, self._fail_generic)

    def open_link(self, artifact: Artifact) -> None:
        self._ctx.call(
            lambda client: client.artifact_download_url(artifact["id"]),
            lambda url: open_uri(self._ctx.window, url, self._report),
            self._fail_generic,
        )

    def delete(self, artifact: Artifact) -> None:
        name = artifact["fileName"]

        def deleted(_result: Artifact | None) -> None:
            self._on_deleted(artifact["id"])
            self._ctx.toast(DELETE["done"].format(name=name))

        def failed(error: BaseException) -> None:
            if is_missing(error):
                self._on_deleted(artifact["id"])
                return
            self._report(DELETE["failed"].format(name=name, error=describe_error(error)))

        confirm(
            self._ctx.window,
            DELETE["title"].format(name=name),
            DELETE["body"],
            DELETE["confirm"],
            DELETE["cancel"],
            lambda: self._ctx.call(lambda client: client.delete_artifact(artifact["id"]), deleted, failed),
        )

    def send(self, artifact: Artifact) -> None:
        targets = online_targets(self._taildrop)
        if not targets:
            self._report(TAILDROP["no_targets"])
            self.load_taildrop()
            return
        labels = {target["id"]: target_label(target) for target in targets}
        name = artifact["fileName"]

        def chosen(target_id: str) -> None:
            device = labels.get(target_id, target_id)
            self._ctx.toast(TAILDROP["sending"].format(name=name, device=device))
            self._ctx.call(
                lambda client: client.send_artifact_taildrop(artifact["id"], target_id),
                lambda _result: self._ctx.toast(TAILDROP["sent"].format(name=name, device=device)),
                lambda error: self._report(TAILDROP["failed"].format(name=name, error=self._describe(artifact, error))),
            )

        choose(
            self._ctx.window,
            TAILDROP["title"].format(name=name),
            TAILDROP["body"],
            list(labels.items()),
            TAILDROP["confirm"],
            TAILDROP["cancel"],
            chosen,
        )

    def _chosen(self, dialog: Gtk.FileDialog, result, artifact: Artifact) -> None:
        try:
            file = dialog.save_finish(result)
        except GLib.Error:
            return
        path = file.get_path() if file else None
        if path:
            self._download(artifact, path)

    def _download(self, artifact: Artifact, path: str) -> None:
        artifact_id = artifact["id"]
        self._downloads[artifact_id] = None
        self._on_change()
        last = [0.0]

        def progress(received: int, total: int | None) -> None:
            if not total:
                return
            fraction = received / total
            if fraction - last[0] >= PROGRESS_STEP or received >= total:
                last[0] = fraction
                call_on_main(self._progress, artifact_id, fraction)

        def done() -> None:
            self._downloads.pop(artifact_id, None)
            self._on_change()

        self._ctx.toast(ARTIFACTS["downloading"].format(name=artifact["fileName"]))
        self._ctx.call(
            lambda client: download_artifact(client, artifact_id, path, artifact.get("sha256"), progress),
            lambda saved: self._ctx.toast(ARTIFACTS["saved"].format(name=GLib.path_get_basename(saved))),
            lambda error: self._report(ARTIFACTS["failed"].format(error=self._describe(artifact, error))),
            done,
        )

    def _progress(self, artifact_id: str, fraction: float) -> None:
        if artifact_id in self._downloads:
            self._downloads[artifact_id] = fraction
            self._on_progress(artifact_id, fraction)

    def _describe(self, artifact: Artifact, error: BaseException) -> str:
        if is_missing(error):
            return ARTIFACTS["missing"].format(name=artifact["fileName"])
        return describe_error(error)

    def _fail_generic(self, error: BaseException) -> None:
        self._report(describe_error(error))
