import hashlib
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from tesseract_desktop.api.client import ControllerClient
from tesseract_desktop.api.errors import ApiError
from tesseract_desktop.api.paths import rest
from tesseract_desktop.api.types import SERVER_EVENT_TYPES
from tesseract_desktop.pages.files import model
from tesseract_desktop.pages.files.download import ChecksumMismatch, checksum_matches, download_artifact, download_file
from tesseract_desktop.pages.files.labels import FILES, SOURCES
from tesseract_desktop.paths import ICONS_DIR
from tesseract_desktop.theme.icons import icon_candidates
from tesseract_desktop.util.format import parse_iso

NOW = parse_iso("2026-09-28T12:00:00Z")


def artifact(id: str, project_id: str = "app", created: str = "2026-09-28T11:00:00Z", **extra) -> dict:
    base = {"id": id, "projectId": project_id, "buildId": None, "fileName": f"{id}.apk", "path": f"/workspace/artifacts/{id}.apk",
            "sizeBytes": 3 * 1024 * 1024, "sha256": "f" * 64, "platform": "android", "source": "build",
            "agentRunId": None, "note": None, "createdAt": created}
    base.update(extra)
    return base


def test_artifact_meta_and_detail():
    item = artifact("a")
    assert model.artifact_meta(item, NOW) == "3 MB · android · 1h ago"
    assert model.artifact_meta(item, NOW, "My App") == "My App · 3 MB · android · 1h ago"
    assert model.artifact_detail(item) == "sha256 fffffff"
    assert model.artifact_detail(dict(item, note="  Debug build for QA ")) == "Debug build for QA"


def test_source_badge_defaults_to_build():
    assert model.source_badge(artifact("a", source="agent")) == (SOURCES["agent"], "info")
    assert model.source_badge(artifact("a")) == (SOURCES["build"], "neutral")
    legacy = artifact("a")
    del legacy["source"]
    assert model.source_of(legacy) == "build"


def test_filter_and_sort():
    items = [
        artifact("old", "app", "2026-09-27T10:00:00Z"),
        artifact("new", "web", "2026-09-28T10:00:00Z", source="agent"),
        artifact("mid", "app", "2026-09-28T09:00:00Z", source="agent"),
    ]
    assert [a["id"] for a in model.filter_artifacts(items)] == ["new", "mid", "old"]
    assert [a["id"] for a in model.filter_artifacts(items, "app")] == ["mid", "old"]
    assert [a["id"] for a in model.filter_artifacts(items, source="agent")] == ["new", "mid"]
    assert [a["id"] for a in model.filter_artifacts(items, "app", "build")] == ["old"]
    assert model.filter_artifacts(None) == []


def test_upsert_remove_find():
    items = [artifact("a", created="2026-09-28T10:00:00Z")]
    items = model.upsert_artifact(items, artifact("b", created="2026-09-28T11:00:00Z"))
    assert [a["id"] for a in items] == ["b", "a"]
    items = model.upsert_artifact(items, artifact("a", created="2026-09-28T10:00:00Z", note="n"))
    assert [a["id"] for a in items] == ["b", "a"] and items[1]["note"] == "n"
    assert [a["id"] for a in model.remove_artifact(items, "b")] == ["a"]
    assert model.find_artifact(items, "a")["note"] == "n"
    assert model.find_artifact(items, "zzz") is None
    assert model.find_artifact(None, "a") is None


def test_filter_options_and_subtitle():
    names = model.project_names([{"id": "web", "name": "Website"}, {"id": "app", "name": "app"}])
    items = [artifact("a", "gone"), artifact("b", "web")]
    assert model.project_options(items, names) == [
        (model.ALL, FILES["all_projects"]), ("app", "app"), ("gone", "gone"), ("web", "Website"),
    ]
    assert [option for option, _ in model.source_options()] == [model.ALL, "build", "agent"]
    assert model.files_subtitle(items) == "2 files across 2 projects"
    assert model.files_subtitle([]) == "0 files across 0 projects"


def test_taildrop_targets():
    targets = {"available": True, "targets": [
        {"id": "n2", "hostName": "pixel", "dnsName": None, "os": "android", "online": True},
        {"id": "n1", "hostName": "Laptop", "dnsName": "laptop.ts.net", "os": None, "online": True},
        {"id": "n3", "hostName": "old", "dnsName": None, "os": "linux", "online": False},
    ]}
    assert [t["id"] for t in model.online_targets(targets)] == ["n1", "n2"]
    assert model.target_label(targets["targets"][0]) == "pixel · android"
    assert model.target_label(targets["targets"][1]) == "Laptop"
    assert model.taildrop_available(targets)
    assert model.online_targets(dict(targets, available=False)) == []
    assert not model.taildrop_available(None)


def test_missing():
    assert model.is_missing(ApiError(404, "not_found", "gone"))
    assert not model.is_missing(ApiError(500, "internal", "boom"))
    assert not model.is_missing(ValueError("x"))


def test_safe_file_name():
    assert model.safe_file_name("../../etc/passwd") == "passwd"
    assert model.safe_file_name("..\\win\\a.exe") == "a.exe"
    assert model.safe_file_name("..") == "artifact"
    assert model.safe_file_name("") == "artifact"
    assert model.safe_file_name("app.AppImage") == "app.AppImage"


def test_paths_and_events():
    assert rest.artifact("a/b") == "/v1/artifacts/a%2Fb"
    assert rest.artifact_taildrop("art_1") == "/v1/artifacts/art_1/taildrop"
    assert rest.taildrop_targets() == "/v1/taildrop/targets"
    assert rest.artifacts("app") == "/v1/artifacts?projectId=app"
    assert "artifact.deleted" in SERVER_EVENT_TYPES


def output(path: str, project_id: str = "app", modified: str = "2026-09-28T11:00:00Z", platform: str = "android") -> dict:
    return {"projectId": project_id, "path": path, "fileName": path.rsplit("/", 1)[-1], "sizeBytes": 2048,
            "platform": platform, "modifiedAt": modified}


def test_build_outputs_model():
    apk = output("android/app/build/outputs/apk/release/app-release.apk")
    exe = output("release/build/Desk Setup.exe", "desk", "2026-09-28T11:30:00Z", "windows")
    zipped = output("app.zip", "desk", platform="file")
    assert model.output_key(apk) == "app/android/app/build/outputs/apk/release/app-release.apk"
    assert model.output_folder(apk) == "android/app/build/outputs/apk/release"
    assert model.output_folder(zipped) == "."
    assert model.output_meta(apk, NOW, project="App") == "App · 2 KB · android · 1h ago"
    assert "file" not in model.output_meta(zipped, NOW)
    assert model.filter_outputs([apk, exe]) == [exe, apk]
    assert model.filter_outputs([apk, exe], "app") == [apk]
    assert model.outputs_subtitle([apk, exe]) == "2 builds across 2 projects"
    assert [option[0] for option in model.project_options([apk, exe], {})] == [model.ALL, "app", "desk"]
    assert [option[0] for option in model.view_options()] == [model.SHARED, model.BUILDS]


def test_build_output_paths():
    assert rest.build_outputs() == "/v1/outputs"
    assert rest.build_outputs("app") == "/v1/outputs?projectId=app"
    assert rest.build_output_download("app", "release/A B.exe", "t") == "/v1/projects/app/outputs/download?path=release%2FA%20B.exe&ticket=t"


def test_file_icon_and_project_groups():
    assert model.file_icon("app-release.APK") == "smartphone"
    assert model.file_icon("index.html") == "file-code"
    assert model.file_icon("Setup.AppImage") == "app-window"
    assert model.file_icon("README") == "file"
    items = [artifact("a", "web"), artifact("b", "app"), artifact("c", "web"), artifact("d", "")]
    groups = model.by_project(items, {"web": "Website"})
    assert [(key, title, [i["id"] for i in members]) for key, title, members in groups] == [
        ("web", "Website", ["a", "c"]), ("app", "app", ["b"]), ("", FILES["no_project"], ["d"]),
    ]
    for key in ("smartphone", "file-code", "app-window", "file-archive"):
        assert (ICONS_DIR / "hicolor" / "scalable" / "actions" / f"{icon_candidates(key)[0]}.svg").is_file()


def test_files_icon_is_bundled():
    name = icon_candidates("files")[0]
    assert (ICONS_DIR / "hicolor" / "scalable" / "actions" / f"{name}.svg").is_file()


PAYLOAD = b"artifact-bytes" * 50_000


class _Handler(BaseHTTPRequestHandler):
    requests: list[tuple[str, str, dict | None]] = []

    def _authorized(self) -> bool:
        if self.headers.get("Authorization") == "Bearer secret":
            return True
        self._json(401, {"error": {"code": "unauthorized", "message": "nope"}})
        return False

    def _json(self, status: int, body: object) -> None:
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _record(self) -> dict | None:
        length = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(length)) if length else None
        _Handler.requests.append((self.command, self.path, body))
        return body

    def do_GET(self):  # noqa: N802
        self._record()
        if not self._authorized():
            return
        if "missing" in self.path:
            self._json(404, {"error": {"code": "not_found", "message": "Unknown artifact"}})
            return
        if self.path == "/v1/taildrop/targets":
            self._json(200, {"available": True, "targets": []})
            return
        self.send_response(200)
        self.send_header("Content-Length", str(len(PAYLOAD)))
        self.end_headers()
        self.wfile.write(PAYLOAD)

    def do_DELETE(self):  # noqa: N802
        self._record()
        if self._authorized():
            self._json(200, artifact("art_1"))

    def do_POST(self):  # noqa: N802
        body = self._record()
        if self._authorized():
            self._json(200, artifact("art_1", note=(body or {}).get("targetId")))

    def log_message(self, *_args):
        pass


@pytest.fixture()
def server():
    _Handler.requests = []
    httpd = HTTPServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}"
    httpd.shutdown()


def test_download_artifact_streams_and_verifies(server, tmp_path):
    client = ControllerClient(server, "secret")
    target = tmp_path / "out.bin"
    progress: list[tuple[int, int | None]] = []
    sha = hashlib.sha256(PAYLOAD).hexdigest()
    saved = download_artifact(client, "art_1", str(target), sha, lambda got, total: progress.append((got, total)))
    assert saved == str(target)
    assert target.read_bytes() == PAYLOAD
    assert progress[-1] == (len(PAYLOAD), len(PAYLOAD))
    assert not (tmp_path / "out.bin.part").exists()


def test_download_artifact_checksum_mismatch_discards(server, tmp_path):
    client = ControllerClient(server, "secret")
    target = tmp_path / "out.bin"
    with pytest.raises(ChecksumMismatch):
        download_artifact(client, "art_1", str(target), "0" * 64)
    assert not target.exists() and not (tmp_path / "out.bin.part").exists()


def test_download_artifact_maps_http_errors(server, tmp_path):
    with pytest.raises(ApiError) as error:
        download_artifact(ControllerClient(server, "secret"), "missing", str(tmp_path / "x"))
    assert error.value.status == 404 and error.value.message == "Unknown artifact"
    assert model.is_missing(error.value)
    with pytest.raises(ApiError) as denied:
        download_artifact(ControllerClient(server, "wrong"), "art_1", str(tmp_path / "x"))
    assert denied.value.status == 401


def test_download_file_streams_build_outputs(server, tmp_path):
    client = ControllerClient(server, "secret")
    target = tmp_path / "app-release.apk"
    download_file(client, rest.build_output_download("app", "dist/app.apk"), str(target))
    assert target.read_bytes() == PAYLOAD
    assert _Handler.requests[-1][1] == "/v1/projects/app/outputs/download?path=dist%2Fapp.apk"


def test_checksum_matches():
    assert checksum_matches(None, "abc")
    assert checksum_matches(" ABC ", "abc")
    assert not checksum_matches("abd", "abc")


def test_client_delete_and_taildrop(server):
    client = ControllerClient(server, "secret")
    assert client.delete_artifact("art_1")["id"] == "art_1"
    assert client.taildrop_targets() == {"available": True, "targets": []}
    assert client.send_artifact_taildrop("art_1", "node_7")["note"] == "node_7"
    assert _Handler.requests == [
        ("DELETE", "/v1/artifacts/art_1", None),
        ("GET", "/v1/taildrop/targets", None),
        ("POST", "/v1/artifacts/art_1/taildrop", {"targetId": "node_7"}),
    ]
