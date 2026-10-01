import json

PROTOCOL_VERSION = 1

STATUS_CODES = {
    "bad_request": 400,
    "unauthorized": 401,
    "forbidden": 403,
    "not_found": 404,
    "conflict": 409,
    "internal": 500,
    "unavailable": 503,
}


GATEWAY_MESSAGES = {
    502: "HTTP 502 from the proxy in front of the controller: the controller is not answering behind it.",
    503: "HTTP 503: the controller is unavailable.",
    504: "HTTP 504 from the proxy in front of the controller: the controller timed out.",
}


class ControllerError(Exception):
    pass


class ApiError(ControllerError):
    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message

    def __repr__(self) -> str:
        return f"ApiError({self.status}, {self.code!r}, {self.message!r})"


class NetworkError(ControllerError):
    pass


class RequestTimeout(NetworkError):
    pass


class ProtocolError(ControllerError):
    pass


class ProtocolVersionError(ProtocolError):
    def __init__(self, server_version: object, client_version: int = PROTOCOL_VERSION) -> None:
        super().__init__(f"Controller speaks protocol v{server_version}, this app speaks v{client_version}")
        self.server_version = server_version
        self.client_version = client_version


class NotConfigured(ControllerError):
    def __init__(self) -> None:
        super().__init__("No sandbox connection is configured")


def error_from_response(status: int, body: bytes | str | None) -> ApiError:
    text = body.decode("utf-8", "replace") if isinstance(body, bytes) else (body or "")
    code = next((name for name, value in STATUS_CODES.items() if value == status), "internal")
    message = text.strip()[:300] or GATEWAY_MESSAGES.get(status) or f"HTTP {status}"
    try:
        payload = json.loads(text) if text else None
    except ValueError:
        payload = None
    if isinstance(payload, dict) and isinstance(payload.get("error"), dict):
        error = payload["error"]
        code = str(error.get("code") or code)
        message = str(error.get("message") or message)
    return ApiError(status, code, message)


def check_protocol_version(value: object) -> None:
    if value != PROTOCOL_VERSION:
        raise ProtocolVersionError(value)


def is_auth_error(error: BaseException) -> bool:
    return isinstance(error, ApiError) and (error.status == 401 or error.code == "unauthorized")


def is_retryable(error: BaseException) -> bool:
    if isinstance(error, ProtocolError | NotConfigured):
        return False
    if isinstance(error, ApiError):
        return error.status >= 500 or error.status in (408, 429)
    return True


def describe_error(error: BaseException | None) -> str:
    if error is None:
        return ""
    if is_auth_error(error):
        return "The sandbox rejected this token. Update it in Preferences or rediscover the sandbox."
    if isinstance(error, ApiError):
        return error.message
    if isinstance(error, RequestTimeout):
        return "The sandbox took too long to answer."
    if isinstance(error, NetworkError):
        return "Can't reach the sandbox. Check that the stack is running and the URL is reachable from this machine."
    if isinstance(error, ProtocolVersionError):
        return (
            f"The sandbox speaks protocol v{error.server_version} and this app speaks v{error.client_version}. "
            "Update the app or the sandbox so they match."
        )
    if isinstance(error, ProtocolError):
        return "The controller answered in an unexpected format. Update the app or the sandbox so their versions match."
    if isinstance(error, NotConfigured):
        return "No sandbox is configured yet. Open Preferences to discover it or enter its URL and token."
    return str(error) or "Something went wrong."
