from collections.abc import Callable
from datetime import datetime
from typing import TypeVar

from ..api import types as T
from ..api.client import ControllerClient
from ..api.errors import ApiError, ControllerError, NetworkError, describe_error, is_auth_error
from ..api.paths import rest

HOST_TIMEOUT_S = 10.0

R = TypeVar("R")


class HostRequestError(RuntimeError):
    def __init__(self, message: str, auth: bool = False) -> None:
        super().__init__(message)
        self.auth = auth


class HostAndroidClient:
    """The host daemon's Android API. `credential` is a PIN session, or the host token for `unlock`."""

    def __init__(self, base_url: str, credential: str) -> None:
        self.base_url = base_url
        self._http = ControllerClient(base_url, credential, HOST_TIMEOUT_S)

    def unlock(self, pin: str) -> T.HostSession:
        return self._request(lambda: self._http.post(rest.host_unlock(), {"pin": pin}))

    def status(self) -> T.HostAndroidStatus:
        return self._request(lambda: self._http.get(rest.android()))

    def start_emulator(self, avd: str) -> None:
        self._request(lambda: self._http.post(rest.android_emulator(), {"avd": avd}))

    def stop_emulator(self) -> None:
        self._request(lambda: self._http.delete(rest.android_emulator()))

    def link_sandbox(self, sandbox_url: str, token: str) -> T.AndroidLinkInfo:
        return self._request(lambda: self._http.post(rest.android_link(), {"sandboxUrl": sandbox_url, "token": token}))

    def _request(self, call: Callable[[], R]) -> R:
        try:
            return call()
        except ControllerError as error:
            raise HostRequestError(describe_host_error(error, self.base_url), is_auth_error(error)) from error


def session_expiry(session: T.HostSession) -> float:
    return datetime.fromisoformat(session["expiresAt"].replace("Z", "+00:00")).timestamp()


def describe_host_error(error: BaseException, url: str) -> str:
    if isinstance(error, ApiError):
        return error.message
    if isinstance(error, NetworkError):
        return f"The host shell is not answering at {url}"
    return describe_error(error)
