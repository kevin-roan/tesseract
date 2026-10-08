import json

import pytest

from tesseract_desktop.config.discovery import (
    ContainerNetwork,
    DiscoveryError,
    candidate_api_urls,
    container_network,
    discover_docker,
    parse_inspect,
    parse_pair_json,
    sandbox_container,
)
from tesseract_desktop.config.model import ConnectionConfig
from tesseract_desktop.config.storage import load_env_config, load_file_config, save_file_config

TOKEN = "q3Jx0mZ8yWv1_bT7-kLp2sR4nC6dE9fG0hI1jK2lM3n"
PAIR_OUTPUT = json.dumps({
    "link": f"tesseract://pair?url=https%3A%2F%2Ftesseract-sandbox.tail1.ts.net&token={TOKEN}&name=tesseract-sandbox",
    "url": "https://tesseract-sandbox.tail1.ts.net",
    "name": "tesseract-sandbox",
})


def inspect_json(ports=None, networks=None, mode="bridge"):
    return json.dumps([{
        "HostConfig": {"NetworkMode": mode},
        "NetworkSettings": {"Ports": ports or {}, "Networks": networks or {}},
    }])


def test_container_name_follows_compose_project():
    assert sandbox_container({}) == "tesseract-sandbox-1"
    assert sandbox_container({"TESSERACT_COMPOSE_PROJECT": "e2e"}) == "e2e-sandbox-1"


def test_parse_pair_json_extracts_token():
    info = parse_pair_json("warning: noise\n" + PAIR_OUTPUT + "\n")
    assert (info.url, info.token, info.name) == ("https://tesseract-sandbox.tail1.ts.net", TOKEN, "tesseract-sandbox")


def test_parse_pair_json_rejects_garbage():
    with pytest.raises(DiscoveryError):
        parse_pair_json("not json")
    with pytest.raises(DiscoveryError):
        parse_pair_json(json.dumps({"link": "tesseract://pair?url=x"}))


def test_parse_inspect_ports_networks_and_mode():
    net = parse_inspect(inspect_json(
        {"7700/tcp": [{"HostIp": "127.0.0.1", "HostPort": "7700"}], "5901/tcp": [{"HostIp": "", "HostPort": "5901"}]},
        {"tesseract_default": {"IPAddress": "172.22.0.2"}},
        "container:abc123",
    ))
    assert net == ContainerNetwork((("127.0.0.1", "7700"),), ("172.22.0.2",), "abc123")


def test_container_network_follows_shared_namespace():
    calls = []

    def runner(args, _timeout):
        calls.append(list(args))
        if args[1] == "tesseract-sandbox-1":
            return inspect_json(mode="container:sidecar")
        return inspect_json(networks={"n": {"IPAddress": "172.22.0.2"}})

    net = container_network("tesseract-sandbox-1", runner)
    assert net.addresses == ("172.22.0.2",)
    assert calls[1] == ["inspect", "sidecar"]


def test_candidate_urls_order_and_dedupe():
    net = ContainerNetwork((("0.0.0.0", "7710"), ("100.64.0.9", "7700")), ("172.22.0.2",))
    urls = candidate_api_urls("https://sb.tail1.ts.net", net, {"TESSERACT_BIND_ADDR": "100.64.0.9"})
    assert urls == [
        "http://127.0.0.1:7710",
        "http://100.64.0.9:7700",
        "http://127.0.0.1:7700",
        "http://172.22.0.2:7700",
        "https://sb.tail1.ts.net",
    ]


def test_discover_prefers_reachable_local_address():
    def runner(args, _timeout):
        return PAIR_OUTPUT if args[0] == "exec" else inspect_json(networks={"n": {"IPAddress": "172.22.0.2"}})

    result = discover_docker({}, runner, lambda url, _t: url == "http://172.22.0.2:7700")
    assert result.reachable
    assert result.config.api_url == "http://172.22.0.2:7700"
    assert result.config.pairing_url == "https://tesseract-sandbox.tail1.ts.net"
    assert result.config.token == TOKEN
    assert result.config.pairing_link().startswith("tesseract://pair?url=https%3A%2F%2Ftesseract-sandbox")


def test_discover_falls_back_to_pairing_url_when_nothing_answers():
    def runner(args, _timeout):
        if args[0] == "inspect":
            raise DiscoveryError("no such container")
        return PAIR_OUTPUT

    result = discover_docker({}, runner, lambda _url, _t: False)
    assert not result.reachable
    assert result.config.api_url == "https://tesseract-sandbox.tail1.ts.net"
    assert [url for url, _ in result.tried][-1] == "https://tesseract-sandbox.tail1.ts.net"


def test_file_config_round_trip(tmp_path):
    path = tmp_path / "config.json"
    path.write_text(json.dumps({"theme": "keep-me"}))
    config = ConnectionConfig("http://127.0.0.1:7700", TOKEN, "rig", "https://sb.ts.net")
    save_file_config(config, path)
    assert (path.stat().st_mode & 0o777) == 0o600
    data = json.loads(path.read_text())
    assert data == {"theme": "keep-me", "url": "http://127.0.0.1:7700", "token": TOKEN, "name": "rig", "pairingUrl": "https://sb.ts.net"}
    loaded = load_file_config(path)
    assert loaded == config.with_(source="file")


def test_invalid_file_config_is_ignored(tmp_path):
    path = tmp_path / "config.json"
    path.write_text(json.dumps({"url": "ftp://x", "token": TOKEN}))
    assert load_file_config(path) is None
    assert load_file_config(tmp_path / "missing.json") is None


def test_env_config():
    assert load_env_config({}) is None
    config = load_env_config({"TESSERACT_DESKTOP_URL": "http://127.0.0.1:7700/v1", "TESSERACT_TOKEN": TOKEN})
    assert config.api_url == "http://127.0.0.1:7700"
    assert config.source == "env"
