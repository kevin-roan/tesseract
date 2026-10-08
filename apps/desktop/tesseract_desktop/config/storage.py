import json
import os
from collections.abc import Mapping
from pathlib import Path

from .model import ConnectionConfig

APP_DIR_NAME = "tesseract-desktop"
CONFIG_FILE_NAME = "config.json"
ENV_URL = "TESSERACT_DESKTOP_URL"
ENV_TOKEN = "TESSERACT_TOKEN"
ENV_NAME = "TESSERACT_DESKTOP_NAME"
ENV_PAIRING_URL = "TESSERACT_DESKTOP_PAIRING_URL"
ENV_CONFIG_PATH = "TESSERACT_DESKTOP_CONFIG"


def config_dir(env: Mapping[str, str] = os.environ) -> Path:
    base = env.get("XDG_CONFIG_HOME") or str(Path.home() / ".config")
    return Path(base) / APP_DIR_NAME


def config_path(env: Mapping[str, str] = os.environ) -> Path:
    override = env.get(ENV_CONFIG_PATH)
    return Path(override) if override else config_dir(env) / CONFIG_FILE_NAME


def read_settings(path: Path | None = None) -> dict:
    target = path or config_path()
    try:
        data = json.loads(target.read_text("utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def write_settings(data: dict, path: Path | None = None) -> Path:
    target = path or config_path()
    target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    tmp = target.with_suffix(".tmp")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2)
        handle.write("\n")
    os.replace(tmp, target)
    return target


def load_file_config(path: Path | None = None) -> ConnectionConfig | None:
    return ConnectionConfig.from_json(read_settings(path), source="file")


def save_file_config(config: ConnectionConfig, path: Path | None = None) -> Path:
    data = read_settings(path)
    for key in ("url", "token", "name", "pairingUrl"):
        data.pop(key, None)
    data.update(config.to_json())
    return write_settings(data, path)


def clear_file_config(path: Path | None = None) -> None:
    data = read_settings(path)
    for key in ("url", "token", "name", "pairingUrl"):
        data.pop(key, None)
    write_settings(data, path)


def load_env_config(env: Mapping[str, str] = os.environ) -> ConnectionConfig | None:
    url, token = env.get(ENV_URL), env.get(ENV_TOKEN)
    if not url or not token:
        return None
    return ConnectionConfig.from_json(
        {"url": url, "token": token, "name": env.get(ENV_NAME), "pairingUrl": env.get(ENV_PAIRING_URL)}, source="env"
    )
