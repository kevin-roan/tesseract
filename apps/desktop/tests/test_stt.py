import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from monolith_desktop.api.client import ControllerClient
from monolith_desktop.api.errors import ApiError, ProtocolError
from monolith_desktop.api.types import parse_stt_status
from monolith_desktop.strings import STT
from monolith_desktop.stt import model

PROFILES = [
    {"id": "off", "model": None, "threads": 0, "nice": 0, "available": True},
    {"id": "eco", "model": "ggml-tiny.en.bin", "threads": 2, "nice": 19, "available": True},
    {"id": "balanced", "model": "ggml-base.en.bin", "threads": 4, "nice": 10, "available": True},
    {"id": "performance", "model": "ggml-small.en.bin", "threads": 8, "nice": 0, "available": False},
]
STATUS = {
    "profile": "eco",
    "profiles": PROFILES,
    "engine": "whisper.cpp",
    "ready": True,
    "reason": None,
    "model": "ggml-tiny.en.bin",
    "cpus": 16,
    "busy": False,
    "queued": 0,
    "gemini": {"configured": True, "model": "gemini-2.5-flash", "source": "env"},
}


def test_parse_stt_status_round_trips():
    assert parse_stt_status(STATUS) == STATUS


def test_parse_stt_status_defaults():
    loose = parse_stt_status({
        "profile": "turbo",
        "profiles": [{"id": "eco", "threads": "2", "nice": True}, {"id": "bogus"}, "x"],
        "engine": "other",
        "ready": "yes",
        "cpus": -3,
        "queued": 2.7,
        "reason": "",
    })
    assert loose["profile"] == "off" and loose["engine"] is None and loose["ready"] is False
    assert loose["profiles"] == [{"id": "eco", "model": None, "threads": 0, "nice": 0, "available": False}]
    assert (loose["cpus"], loose["queued"], loose["reason"], loose["busy"]) == (0, 2, None, False)
    assert loose["gemini"] == {"configured": False, "model": "", "source": None}
    assert parse_stt_status({})["profiles"] == []
    with pytest.raises(ProtocolError):
        parse_stt_status([])


def test_profile_choices_describe_and_gate_profiles():
    choices = {choice.id: choice for choice in model.profile_choices(parse_stt_status(STATUS))}
    assert list(choices) == ["off", "eco", "balanced", "performance"]
    assert choices["off"].subtitle == STT["profile_off_description"] and choices["off"].available
    assert choices["eco"].subtitle.splitlines() == [
        STT["profile_eco_description"],
        "ggml-tiny.en.bin · 2 threads · nice 19",
    ]
    assert not choices["performance"].available
    assert choices["performance"].subtitle.endswith(STT["model_missing"])
    offline = model.profile_choices(None)
    assert [choice.available for choice in offline] == [True, False, False, False]
    assert not any(STT["model_missing"] in choice.subtitle for choice in offline)


def test_status_rows():
    rows = dict(model.status_rows(parse_stt_status(STATUS)))
    assert rows == {
        "Engine": "whisper.cpp",
        "Model": "ggml-tiny.en.bin",
        "State": "Ready",
        "Activity": "Idle",
        "CPU cores": "16",
    }
    busy = dict(model.status_rows(parse_stt_status({
        **STATUS, "engine": None, "model": None, "ready": False, "reason": "Model missing", "busy": True, "queued": 3, "cpus": 0,
    })))
    assert busy["State"] == "Not ready · Model missing"
    assert busy["Activity"] == "Transcribing · 3 queued"
    assert busy["Engine"] == busy["Model"] == busy["CPU cores"] == STT["none"]


def test_gemini_subtitle_names_the_key_source():
    assert model.gemini_subtitle(parse_stt_status(STATUS)) == "GEMINI_API_KEY on the sandbox · gemini-2.5-flash"
    saved = parse_stt_status({**STATUS, "gemini": {"configured": True, "model": "gemini-2.5-flash", "source": "settings"}})
    assert model.gemini_subtitle(saved).startswith(STT["gemini_source_settings"])
    assert model.gemini_subtitle(parse_stt_status({**STATUS, "gemini": None})) == STT["gemini_source_none"]
    assert model.gemini_subtitle(None) == ""


def test_status_error_message_flags_outdated_controller():
    assert model.status_error_message(ApiError(404, "not_found", "No route")) == STT["outdated"]
    assert model.status_error_message(ApiError(500, "internal", "boom")) == "boom"


class _Handler(BaseHTTPRequestHandler):
    requests: list[tuple[str, str, dict | None]] = []

    def _json(self, status: int, body: object) -> None:
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _handle(self) -> None:
        length = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(length)) if length else None
        _Handler.requests.append((self.command, self.path, body))
        if self.headers.get("Authorization") != "Bearer secret":
            self._json(401, {"error": {"code": "unauthorized", "message": "nope"}})
        elif body and body.get("profile") == "performance":
            self._json(409, {"error": {"code": "conflict", "message": "Model not installed"}})
        else:
            self._json(200, {**STATUS, "profile": (body or {}).get("profile", STATUS["profile"])})

    do_GET = do_PUT = _handle  # noqa: N815

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


def test_client_stt_status_and_set_profile(server):
    client = ControllerClient(server, "secret")
    assert client.stt_status() == STATUS
    assert client.set_stt_profile("balanced")["profile"] == "balanced"
    with pytest.raises(ApiError) as conflict:
        client.set_stt_profile("performance")
    assert conflict.value.status == 409 and conflict.value.message == "Model not installed"
    with pytest.raises(ValueError):
        client.set_stt_profile("turbo")
    assert client.set_gemini_api_key("  AIza-key \n")["profile"] == "eco"
    assert client.set_gemini_api_key(None)["profile"] == "eco"
    with pytest.raises(ValueError):
        client.set_gemini_api_key("   ")
    assert _Handler.requests == [
        ("GET", "/v1/stt", None),
        ("PUT", "/v1/stt", {"profile": "balanced"}),
        ("PUT", "/v1/stt", {"profile": "performance"}),
        ("PUT", "/v1/stt", {"geminiApiKey": "AIza-key"}),
        ("PUT", "/v1/stt", {"geminiApiKey": None}),
    ]
    with pytest.raises(ApiError) as denied:
        ControllerClient(server, "wrong").stt_status()
    assert denied.value.status == 401
