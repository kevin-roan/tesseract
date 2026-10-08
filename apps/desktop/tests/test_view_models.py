from tesseract_desktop.api.errors import NetworkError
from tesseract_desktop.config.model import ConnectionConfig
from tesseract_desktop.pages.overview import model
from tesseract_desktop.services.connection_view import banner_for, connection_label, connection_tone
from tesseract_desktop.store import ConnectionState, Observable

STATUS = {
    "sandboxId": "tesseract-sandbox",
    "hostname": "sandbox",
    "version": "0.1.0",
    "startedAt": "2026-01-01T00:00:00Z",
    "uptimeSec": 3700,
    "resources": {
        "cpu": {"cores": 4, "load1": 2.0, "load5": 1.0, "load15": 0.5},
        "memory": {"totalBytes": 8 * 1024**3, "usedBytes": 2 * 1024**3},
        "disk": {"path": "/workspace", "totalBytes": 100 * 1024**3, "usedBytes": 25 * 1024**3},
    },
    "display": {
        "display": ":1", "available": True, "width": 1600, "height": 900,
        "vnc": {"available": False, "port": 5901, "password": None}, "webPath": "/ui/vnc",
    },
    "tools": [{"name": "node", "version": "24.1.0"}, {"name": "wine", "version": None}],
    "counts": {"projects": 3, "runningProcesses": 1, "activeBuilds": 0, "terminals": 2, "agentRuns": 5},
}


def test_observable_notifies_on_change_only():
    seen = []
    value = Observable(1)
    unsubscribe = value.subscribe(seen.append)
    value.set(1)
    value.set(2)
    unsubscribe()
    value.set(3)
    assert seen == [1, 2]
    doubled = value.derive(lambda v: v * 2)
    value.set(4)
    assert doubled.value == 8


def test_resource_items():
    items = {item.id: item for item in model.resource_items(STATUS)}
    assert items["cpu"].value == "2.00"
    assert items["cpu"].progress == 0.5
    assert (items["memory"].value, items["memory"].unit, items["memory"].progress) == ("2", "GB", 0.25)
    assert items["disk"].progress == 0.25
    assert items["uptime"].value == "1h 1m"


def test_counts_navigate():
    targets = []
    items = model.count_items(STATUS, targets.append)
    assert [item.value for item in items] == ["3", "1", "0", "2", "5"]
    items[0].on_activate()
    assert targets == ["projects"]


def test_rows_and_subtitle():
    assert model.display_rows(STATUS)[1] == ("Resolution", "1600×900")
    assert model.tool_rows(STATUS)[1] == ("wine", "not installed")
    assert model.subtitle(STATUS) == "up 1h 1m · sandbox · v0.1.0"


def test_empty_models_follow_connection_state():
    offline = ConnectionState("offline", error=NetworkError("x"), error_message="Can't reach")
    empty = model.empty_model(offline)
    assert empty.message == "Can't reach"
    assert empty.action == "retry"
    assert model.empty_model(ConnectionState("discovering")).loading
    assert model.empty_model(ConnectionState("online")) is None


def test_attention_notice():
    assert model.attention_notice({"unreadCount": 3, "attentionCount": 0}) is None
    notice = model.attention_notice({"unreadCount": 3, "attentionCount": 2})
    assert "2 sessions" in notice.message
    assert notice.action == "inbox"


def test_connection_view():
    config = ConnectionConfig("http://127.0.0.1:7700", "t", "rig")
    state = ConnectionState("online", config)
    assert connection_tone(state) == "success"
    assert connection_label(state) == "rig · Online"
    assert not banner_for(state).visible
    offline = banner_for(ConnectionState("offline", config, error_message="down"))
    assert offline.visible and "down" in offline.title and offline.action == "retry"
