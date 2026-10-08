import re
from dataclasses import dataclass
from urllib.parse import quote, unquote_to_bytes

PAIRING_SCHEME = "tesseract"
PAIRING_ACTION = "pair"
MAX_PAIRING_NAME_LENGTH = 64

_JS_WHITESPACE = (
    "\t\n\v\f\r              "
    "    　﻿"
)
_WS_CLASS = "[" + re.escape(_JS_WHITESPACE) + "]"

TOKEN_PATTERN = re.compile(r"[\x21-\x7e]{1,1024}")
_BASE_URL = re.compile(r"([a-z][a-z0-9+.-]*)://([^/?#]*)([^?#]*)", re.I)
_HOST_PORT = re.compile(r"(.*?)(?::([^:\]]*))?")
_HOSTNAME = re.compile(r"(?=.{1,253}\Z)[a-z0-9_](?:[a-z0-9_-]{0,62})(?:\.[a-z0-9_](?:[a-z0-9_-]{0,62}))*\.?")
_IPV6 = re.compile(r"\[[0-9a-f:.]+\]")
_API_PATH_NOISE = re.compile(r"/(?:v[0-9]+|ui)(?:/.*)?\Z", re.I)
_INVALID_PATH_CHARS = re.compile(_WS_CLASS[:-1] + r"\x00-\x1f\x7f\\]")
_TRAILING_SLASHES = re.compile(r"/+\Z")
_PAIRING_LINK = re.compile(
    rf"{PAIRING_SCHEME}:///?{PAIRING_ACTION}/?(?:\?([^#]*))?(?:#.*)?", re.I | re.S
)
_SCHEME = re.compile(rf"{PAIRING_SCHEME}:", re.I)
_DEFAULT_PORTS = {"http": "80", "https": "443"}
_MALFORMED_ESCAPE = re.compile(r"%(?![0-9A-Fa-f]{2})")


class BaseUrlError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class PairingError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class PairingPayload:
    url: str
    token: str
    name: str | None = None


def js_trim(value: str) -> str:
    return value.strip(_JS_WHITESPACE)


def _js_slice(value: str, length: int) -> str:
    units = value.encode("utf-16-le", "surrogatepass")
    return units[: length * 2].decode("utf-16-le", "surrogatepass")


def encode_uri_component(value: str) -> str:
    return quote(value, safe="!*'()")


def decode_uri_component(value: str) -> str | None:
    if _MALFORMED_ESCAPE.search(value):
        return None
    try:
        return unquote_to_bytes(value).decode("utf-8")
    except (UnicodeDecodeError, UnicodeEncodeError):
        return None


def build_query(params: dict[str, object | None]) -> str:
    pairs = [
        f"{encode_uri_component(key)}={encode_uri_component(_js_string(value))}"
        for key, value in params.items()
        if value is not None
    ]
    return f"?{'&'.join(pairs)}" if pairs else ""


def _js_string(value: object) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def parse_params(query: str) -> dict[str, str]:
    result: dict[str, str] = {}
    body = query[1:] if query.startswith(("?", "#")) else query
    if not body:
        return result
    for pair in body.split("&"):
        if not pair:
            continue
        raw_key, sep, raw_value = pair.partition("=")
        key = decode_uri_component(raw_key)
        value = decode_uri_component(raw_value if sep else "")
        if key is None or value is None or key in result:
            continue
        result[key] = value
    return result


def parse_base_url(value: str) -> str:
    trimmed = js_trim(value)
    if not trimmed:
        raise BaseUrlError("empty", "URL is empty")
    match = _BASE_URL.match(trimmed)
    scheme = match.group(1).lower() if match else None
    if not match or scheme not in ("http", "https"):
        raise BaseUrlError("unsupported_scheme", "URL must start with http:// or https://")
    authority = match.group(2) or ""
    if "@" in authority:
        raise BaseUrlError("credentials_not_allowed", "URL must not contain credentials")
    host_port = _HOST_PORT.fullmatch(authority)
    host = (host_port.group(1) if host_port else "").lower()
    raw_port = (host_port.group(2) if host_port else None) or None
    if not host or not (_HOSTNAME.fullmatch(host) or _IPV6.fullmatch(host)):
        raise BaseUrlError("invalid_host", "URL host is missing or invalid")
    port: int | None = None
    if raw_port is not None:
        if not re.fullmatch(r"[0-9]+", raw_port) or not 1 <= int(raw_port) <= 65535:
            raise BaseUrlError("invalid_port", "URL port must be between 1 and 65535")
        port = int(raw_port)
    normalized_port = "" if port is None or _DEFAULT_PORTS[scheme] == str(port) else f":{port}"
    raw_path = match.group(3) or ""
    if _INVALID_PATH_CHARS.search(raw_path):
        raise BaseUrlError("invalid_path", "URL path must not contain spaces, control characters or backslashes")
    path = _TRAILING_SLASHES.sub("", _API_PATH_NOISE.sub("", raw_path, count=1))
    host = host[:-1] if host.endswith(".") else host
    return f"{scheme}://{host}{normalized_port}{path}"


def normalize_base_url(value: str) -> str | None:
    try:
        return parse_base_url(value)
    except BaseUrlError:
        return None


def to_websocket_url(http_url: str) -> str:
    lowered = http_url[:6].lower()
    if lowered.startswith("https:"):
        return f"wss:{http_url[6:]}"
    if lowered.startswith("http:"):
        return f"ws:{http_url[5:]}"
    return http_url


def is_valid_token(token: str) -> bool:
    return TOKEN_PATTERN.fullmatch(token) is not None


def _normalize_name(name: str | None) -> str | None:
    if name is None:
        return None
    trimmed = js_trim(_js_slice(js_trim(name), MAX_PAIRING_NAME_LENGTH))
    return trimmed or None


def build_pairing_link(url: str, token: str, name: str | None = None) -> str:
    try:
        base = parse_base_url(url)
    except BaseUrlError as error:
        raise PairingError("invalid_url", f"Invalid pairing url: {error}") from error
    if not is_valid_token(token):
        raise PairingError("invalid_token", "Invalid pairing token")
    query = build_query({"url": base, "token": token, "name": _normalize_name(name)})
    return f"{PAIRING_SCHEME}://{PAIRING_ACTION}{query}"


def parse_pairing_link(text: str) -> PairingPayload:
    compact = re.sub(_WS_CLASS + "+", "", text)
    if not compact:
        raise PairingError("empty", "Pairing link is empty")
    if not _SCHEME.match(compact):
        raise PairingError("invalid_scheme", f"Pairing link must start with {PAIRING_SCHEME}://")
    match = _PAIRING_LINK.fullmatch(compact)
    if not match:
        raise PairingError("invalid_action", f"Pairing link must be {PAIRING_SCHEME}://{PAIRING_ACTION}?…")
    params = parse_params(match.group(1) or "")
    if not params.get("url"):
        raise PairingError("missing_url", "Pairing link has no url")
    try:
        url = parse_base_url(params["url"])
    except BaseUrlError as error:
        raise PairingError("invalid_url", str(error)) from error
    token = params.get("token")
    if not token:
        raise PairingError("missing_token", "Pairing link has no token")
    if not is_valid_token(token):
        raise PairingError("invalid_token", "Pairing token is invalid")
    return PairingPayload(url=url, token=token, name=_normalize_name(params.get("name")))


def qr_matrix(text: str, border: int = 2) -> list[list[bool]]:
    import qrcode
    from qrcode.constants import ERROR_CORRECT_M

    code = qrcode.QRCode(error_correction=ERROR_CORRECT_M, border=border)
    code.add_data(text)
    code.make(fit=True)
    return code.get_matrix()


def _rgba_bytes(color: str) -> bytes:
    value = color.lstrip("#")
    if len(value) == 6:
        value += "ff"
    return bytes.fromhex(value)


def qr_rgba(text: str, dark: str = "#000000", light: str = "#ffffff", scale: int = 8, border: int = 2) -> tuple[bytes, int]:
    matrix = qr_matrix(text, border)
    on, off = _rgba_bytes(dark), _rgba_bytes(light)
    rows = []
    for row in matrix:
        line = b"".join((on if cell else off) * scale for cell in row)
        rows.append(line * scale)
    return b"".join(rows), len(matrix) * scale


def qr_texture(text: str, dark: str = "#000000", light: str = "#ffffff", scale: int = 8, border: int = 2):
    import gi

    gi.require_version("Gdk", "4.0")
    from gi.repository import Gdk, GLib

    data, size = qr_rgba(text, dark, light, scale, border)
    return Gdk.MemoryTexture.new(size, size, Gdk.MemoryFormat.R8G8B8A8, GLib.Bytes.new(data), size * 4)
