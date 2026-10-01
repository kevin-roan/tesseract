import pytest

gi = pytest.importorskip("gi")
gi.require_version("Gdk", "4.0")

from monolith_desktop.pages.display import model  # noqa: E402
from monolith_desktop.store import ConnectionState  # noqa: E402
from monolith_desktop.vnc.session import SessionState, display_ready  # noqa: E402

ONLINE = ConnectionState(status="online")
READY = {"display": ":1", "available": True, "width": 1600, "height": 900, "vnc": {"available": True, "port": 5901, "password": "pw"}}
NO_VNC = {**READY, "vnc": {"available": False, "port": 5901, "password": "pw"}}
NO_DISPLAY = {**NO_VNC, "available": False}


def test_display_ready():
    assert display_ready(READY)
    assert not display_ready(NO_VNC)
    assert not display_ready(None)


def test_mode_for():
    assert model.mode_for(ConnectionState(status="offline"), READY, None) == "offline"
    assert model.mode_for(ONLINE, None, None) == "loading"
    assert model.mode_for(ONLINE, None, "boom") == "error"
    assert model.mode_for(ONLINE, READY, None) == "viewer"
    assert model.mode_for(ONLINE, NO_VNC, None) == "preview"
    assert model.mode_for(ONLINE, NO_DISPLAY, None) == "no_display"


def test_badge_follows_session_in_viewer():
    assert model.badge("viewer", SessionState(phase="connected")) == ("Live", "success")
    assert model.badge("viewer", SessionState(phase="auth_failed"))[1] == "danger"
    assert model.badge("preview", SessionState()) == ("Screenshots only", "warning")


def test_overlay_model():
    assert model.overlay_model(SessionState(phase="connected"), 0) is None
    connecting = model.overlay_model(SessionState(phase="connecting"), 0)
    assert connecting.loading and connecting.action_label is None
    retry = model.overlay_model(SessionState(phase="retrying", error="socket closed", attempt=2, retry_at=13.2), 10.0)
    assert retry.message == "socket closed. Reconnecting in 3s (attempt 2)."
    assert not retry.loading and retry.action_label
    failed = model.overlay_model(SessionState(phase="failed"), 0)
    assert failed.message is None


def test_meta_text():
    session = SessionState(phase="connected", width=1280, height=800, name="TheOne")
    assert model.meta_text("viewer", session, READY, 0.5) == "1280×800 · 50% · TheOne"
    assert model.meta_text("preview", SessionState(), NO_VNC, None) == "1600×900"
    assert model.meta_text("no_display", SessionState(), NO_DISPLAY, None) == ""


def test_enabled_actions():
    assert model.enabled_actions("offline", SessionState()) == frozenset()
    assert model.enabled_actions("loading", SessionState()) == {"reconnect"}
    assert "keys" not in model.enabled_actions("viewer", SessionState(phase="connecting"))
    assert "keys" in model.enabled_actions("viewer", SessionState(phase="connected"))
    assert "fullscreen" not in model.enabled_actions("preview", SessionState())


def test_empty_model():
    offline = model.empty_model("offline", ConnectionState(status="offline", error_message="refused"), None, None)
    assert offline.message == "refused" and offline.action == "retry"
    assert model.empty_model("no_display", ONLINE, NO_DISPLAY, None).message.startswith("Xvnc on :1")
    assert model.empty_model("loading", ONLINE, None, None).loading
    assert model.empty_model("viewer", ONLINE, READY, None) is None
