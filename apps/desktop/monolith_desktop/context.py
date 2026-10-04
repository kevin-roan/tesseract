from collections.abc import Callable
from typing import TYPE_CHECKING, Any, TypeVar

from .api.client import ControllerClient
from .api.events import EventStream
from .api.socket import SOUP_AVAILABLE, SocketSession
from .api.tasks import Task, run_async
from .hostshell import HostShellService
from .poller import Poller
from .services.connection import ConnectionService
from .services.metrics import MetricsHistory
from .services.syncback import SyncBackService
from .services.workspace import WorkspaceService
from .store import AppStore
from .theme.manager import ThemeManager

if TYPE_CHECKING:
    from gi.repository import Adw, Gtk

    from .window import MainWindow

T = TypeVar("T")


class AppContext:
    def __init__(self, app: "Adw.Application", store: AppStore, connection: ConnectionService, theme: ThemeManager) -> None:
        self.app = app
        self.store = store
        self.connection = connection
        self.theme = theme
        self.window: "MainWindow | None" = None
        self.workspace = WorkspaceService(store, connection.require_client, connection.events)
        self.metrics = MetricsHistory(store)
        self.syncback = SyncBackService(app, store, connection.require_client, connection.events)
        self.host_shell = HostShellService()

    @property
    def events(self) -> EventStream:
        return self.connection.events

    @property
    def client(self) -> ControllerClient | None:
        return self.connection.client

    def call(
        self,
        fn: Callable[[ControllerClient], T],
        on_success: Callable[[T], None] | None = None,
        on_error: Callable[[BaseException], None] | None = None,
        on_done: Callable[[], None] | None = None,
    ) -> Task[T]:
        return run_async(
            lambda: fn(self.connection.require_client()), on_success=on_success, on_error=on_error, on_done=on_done
        )

    def poll(
        self,
        fn: Callable[[ControllerClient], T],
        interval_s: float,
        on_result: Callable[[T], None],
        on_error: Callable[[BaseException], None] | None = None,
        on_loading: Callable[[bool], None] | None = None,
    ) -> Poller[T]:
        return Poller(lambda: fn(self.connection.require_client()), interval_s, on_result, on_error, on_loading)

    def subscribe(self, event_type: str | None, listener: Callable[[dict[str, Any]], None]) -> Callable[[], None]:
        return self.events.subscribe(event_type, listener)

    def stream(self, path: str, on_message: Callable[[dict[str, Any]], None], **kwargs: Any) -> SocketSession | None:
        if not SOUP_AVAILABLE:
            return None
        return SocketSession(lambda: self.connection.client, path, on_message, **kwargs).open()

    def navigate(self, page_id: str, params: dict[str, Any] | None = None) -> bool:
        return self.window.navigate(page_id, params) if self.window else False

    def push(self, title: str, widget: "Gtk.Widget", header_widgets: "list[Gtk.Widget] | None" = None, tag: str | None = None):
        if self.window is None:
            return None
        return self.window.push(title, widget, header_widgets, tag)

    def pop(self) -> None:
        if self.window:
            self.window.pop()

    def toast(
        self,
        message: str,
        timeout_s: int = 3,
        action_label: str | None = None,
        on_action: Callable[[], None] | None = None,
    ) -> None:
        if self.window:
            self.window.toast(message, timeout_s, action_label, on_action)

    def open_preferences(self, page_id: str | None = None) -> None:
        from .preferences import open_preferences

        open_preferences(self, page_id)
