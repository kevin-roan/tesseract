import json
import os
import shutil
import subprocess
import urllib.error
import urllib.request
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field

from ..pairing import PairingError, normalize_base_url, parse_pairing_link
from .model import ConnectionConfig
from .storage import load_env_config, load_file_config

DEFAULT_PROJECT = "theone"
SANDBOX_SERVICE = "sandbox"
CONTROLLER_PORT = 7700
SANDBOX_USER = "dev"
CONTROLLER_BIN = "theone-controller"
DOCKER_TIMEOUT_S = 15.0
PROBE_TIMEOUT_S = 2.0
PROTOCOL_VERSION = 1

Runner = Callable[[Sequence[str], float], str]
Prober = Callable[[str, float], bool]


class DiscoveryError(Exception):
    pass


@dataclass(frozen=True)
class PairInfo:
    link: str
    url: str
    token: str
    name: str | None


@dataclass(frozen=True)
class ContainerNetwork:
    published: tuple[tuple[str, str], ...] = ()
    addresses: tuple[str, ...] = ()
    network_container: str | None = None


@dataclass
class DiscoveryResult:
    config: ConnectionConfig | None
    reachable: bool
    tried: list[tuple[str, str]] = field(default_factory=list)
    message: str = ""


def compose_project(env: Mapping[str, str] = os.environ) -> str:
    return env.get("THEONE_COMPOSE_PROJECT") or DEFAULT_PROJECT


def sandbox_container(env: Mapping[str, str] = os.environ) -> str:
    return f"{compose_project(env)}-{SANDBOX_SERVICE}-1"


def run_docker(args: Sequence[str], timeout: float = DOCKER_TIMEOUT_S) -> str:
    docker = shutil.which("docker")
    if not docker:
        raise DiscoveryError("docker is not installed on this machine")
    try:
        completed = subprocess.run(
            [docker, *args], capture_output=True, text=True, timeout=timeout, check=False
        )
    except subprocess.TimeoutExpired as error:
        raise DiscoveryError(f"docker {args[0]} timed out") from error
    except OSError as error:
        raise DiscoveryError(str(error)) from error
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout).strip().splitlines()
        raise DiscoveryError(detail[-1] if detail else f"docker {args[0]} failed ({completed.returncode})")
    return completed.stdout


def parse_pair_json(output: str) -> PairInfo:
    for line in reversed([line.strip() for line in output.splitlines() if line.strip()]):
        try:
            data = json.loads(line)
        except ValueError:
            continue
        if not isinstance(data, dict) or not isinstance(data.get("link"), str):
            continue
        try:
            payload = parse_pairing_link(data["link"])
        except PairingError as error:
            raise DiscoveryError(f"controller printed an invalid pairing link: {error}") from error
        url = data.get("url")
        name = data.get("name")
        return PairInfo(
            link=data["link"],
            url=normalize_base_url(url) if isinstance(url, str) and normalize_base_url(url) else payload.url,
            token=payload.token,
            name=name if isinstance(name, str) and name else payload.name,
        )
    raise DiscoveryError("theone-controller pair --json printed no pairing link")


def docker_pair(container: str, runner: Runner = run_docker) -> PairInfo:
    output = runner(["exec", "-u", SANDBOX_USER, container, CONTROLLER_BIN, "pair", "--json"], DOCKER_TIMEOUT_S)
    return parse_pair_json(output)


def parse_inspect(output: str, port: int = CONTROLLER_PORT) -> ContainerNetwork:
    try:
        data = json.loads(output)
    except ValueError as error:
        raise DiscoveryError("docker inspect printed invalid JSON") from error
    item = data[0] if isinstance(data, list) and data else data
    if not isinstance(item, dict):
        return ContainerNetwork()
    settings = item.get("NetworkSettings") or {}
    ports = settings.get("Ports") or {}
    published = tuple(
        (binding.get("HostIp") or "", binding.get("HostPort") or "")
        for binding in (ports.get(f"{port}/tcp") or [])
        if isinstance(binding, dict) and binding.get("HostPort")
    )
    addresses = tuple(
        net["IPAddress"]
        for net in (settings.get("Networks") or {}).values()
        if isinstance(net, dict) and net.get("IPAddress")
    )
    mode = (item.get("HostConfig") or {}).get("NetworkMode") or ""
    network_container = mode.split(":", 1)[1] if mode.startswith("container:") else None
    return ContainerNetwork(published, addresses, network_container)


def container_network(container: str, runner: Runner = run_docker) -> ContainerNetwork:
    network = parse_inspect(runner(["inspect", container], DOCKER_TIMEOUT_S))
    if network.network_container:
        owner = parse_inspect(runner(["inspect", network.network_container], DOCKER_TIMEOUT_S))
        return ContainerNetwork(
            network.published + owner.published, network.addresses + owner.addresses, network.network_container
        )
    return network


def _host_for(bind: str) -> str:
    if bind in ("", "0.0.0.0", "::", "[::]"):
        return "127.0.0.1"
    return f"[{bind}]" if ":" in bind and not bind.startswith("[") else bind


def candidate_api_urls(
    pairing_url: str | None,
    network: ContainerNetwork | None = None,
    env: Mapping[str, str] = os.environ,
) -> list[str]:
    candidates: list[str] = []
    host_port = env.get("THEONE_CONTROLLER_HOST_PORT") or str(CONTROLLER_PORT)
    bind = env.get("THEONE_BIND_ADDR")
    if network:
        candidates += [f"http://{_host_for(ip)}:{hp}" for ip, hp in network.published]
    if bind:
        candidates.append(f"http://{_host_for(bind)}:{host_port}")
    candidates.append(f"http://127.0.0.1:{host_port}")
    if network:
        candidates += [f"http://{ip}:{CONTROLLER_PORT}" for ip in network.addresses]
    if pairing_url:
        candidates.append(pairing_url)
    seen: set[str] = set()
    ordered = []
    for url in candidates:
        normalized = normalize_base_url(url)
        if normalized and normalized not in seen:
            seen.add(normalized)
            ordered.append(normalized)
    return ordered


def probe_health(url: str, timeout: float = PROBE_TIMEOUT_S) -> bool:
    request = urllib.request.Request(f"{url}/v1/health", headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            data = json.loads(response.read())
    except (OSError, ValueError, urllib.error.URLError):
        return False
    return isinstance(data, dict) and data.get("ok") is True and data.get("protocolVersion") == PROTOCOL_VERSION


def pick_reachable(candidates: Sequence[str], prober: Prober = probe_health) -> tuple[str | None, list[tuple[str, str]]]:
    tried = []
    for url in candidates:
        if prober(url, PROBE_TIMEOUT_S):
            tried.append((url, "ok"))
            return url, tried
        tried.append((url, "unreachable"))
    return None, tried


def discover_docker(
    env: Mapping[str, str] = os.environ, runner: Runner = run_docker, prober: Prober = probe_health
) -> DiscoveryResult:
    container = sandbox_container(env)
    pair = docker_pair(container, runner)
    try:
        network = container_network(container, runner)
    except DiscoveryError:
        network = None
    candidates = candidate_api_urls(pair.url, network, env)
    reachable, tried = pick_reachable(candidates, prober)
    config = ConnectionConfig(
        api_url=reachable or pair.url,
        token=pair.token,
        name=pair.name,
        pairing_url=pair.url,
        source="docker",
        container=container,
    )
    message = (
        f"Found {pair.name or container} at {config.api_url}"
        if reachable
        else f"Found {pair.name or container}, but none of its addresses answered from this machine"
    )
    return DiscoveryResult(config, reachable is not None, tried, message)


def initial_config(env: Mapping[str, str] = os.environ) -> ConnectionConfig | None:
    return load_file_config() or load_env_config(env)
