import json
from dataclasses import dataclass, field

from ..api import types as T
from ..strings import ANDROID_STREAM as S
from .model import HostShellError

HOST_EMULATOR = "host-emulator"
VIEWER_SIZE = "viewer"
MAX_SIZES = (720, 1080, 1280, 1600, 1920, 2560)
BITS_PER_MBIT = 1_000_000
# Mirrors DEFAULT_ANDROID_STREAM and LIMITS in packages/protocol/src/constants.ts.
DEFAULTS: T.AndroidStreamSettings = {
    "encoding": "h264",
    "bitRate": 8_000_000,
    "maxFps": 60,
    "maxSize": None,
    "keyFrameInterval": 2,
    "jpegQuality": 5,
    "device": None,
}
BIT_RATE_MBIT = (0.5, 50.0)
MAX_FPS = (1, 120)
KEY_FRAME_INTERVAL = (1, 10)
JPEG_QUALITY = (2, 31)

Option = tuple[str, str]


@dataclass(frozen=True)
class StreamState:
    settings: T.AndroidStreamSettings = field(default_factory=lambda: dict(DEFAULTS))  # type: ignore[assignment]
    devices: tuple[T.AndroidDevice, ...] = ()


def parse_stream(stdout: str) -> StreamState:
    """The `{ stream, devices }` line of `theone-controller host stream --json`."""
    line = next((line for line in reversed(stdout.splitlines()) if line.strip().startswith("{")), "")
    try:
        data = json.loads(line)
    except ValueError as error:
        raise HostShellError("The controller printed no stream settings") from error
    if not isinstance(data, dict) or not isinstance(data.get("stream"), dict):
        raise HostShellError("The controller printed no stream settings")
    devices = data.get("devices") if isinstance(data.get("devices"), list) else []
    return StreamState({**DEFAULTS, **data["stream"]}, tuple(devices))


def changes(settings: T.AndroidStreamSettings, draft: dict) -> dict:
    """The draft fields that differ from the saved settings."""
    return {key: value for key, value in draft.items() if settings.get(key) != value}


def mbit(bit_rate: int) -> float:
    return bit_rate / BITS_PER_MBIT


def bit_rate(mbit_value: float) -> int:
    return round(mbit_value * BITS_PER_MBIT)


def encoding_options() -> list[Option]:
    return [("h264", S["encoding_h264"]), ("mjpeg", S["encoding_mjpeg"])]


def max_size_options() -> list[Option]:
    return [(VIEWER_SIZE, S["size_viewer"]), *((str(size), S["size_px"].format(size=size)) for size in MAX_SIZES)]


def max_size_id(max_size: int | None) -> str:
    return VIEWER_SIZE if max_size is None else str(max_size)


def max_size_value(option_id: str) -> int | None:
    return None if option_id == VIEWER_SIZE else int(option_id)


def device_label(device: T.AndroidDevice) -> str:
    name = device.get("model") or device["serial"]
    kind = S[f"kind_{device['kind']}"]
    suffix = "" if device["state"] == "device" else f" · {device['state']}"
    return f"{name} · {kind} · {device['serial']}{suffix}"


def device_options(state: StreamState) -> list[Option]:
    """The host emulator first, then every other adb device; a saved device that is gone stays listed."""
    options: list[Option] = [(HOST_EMULATOR, S["device_host"])]
    options += [(device["serial"], device_label(device)) for device in state.devices if not device["hostEmulator"]]
    saved = state.settings.get("device")
    if saved and all(option_id != saved for option_id, _ in options):
        options.append((saved, S["device_missing"].format(serial=saved)))
    return options


def device_id(device: str | None) -> str:
    return device or HOST_EMULATOR


def device_value(option_id: str) -> str | None:
    return None if option_id == HOST_EMULATOR else option_id
