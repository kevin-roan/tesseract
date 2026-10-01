from collections.abc import Callable
from typing import Any, Generic, TypeVar

from gi.repository import GLib

from .api.tasks import Task, run_async

T = TypeVar("T")


class Poller(Generic[T]):
    def __init__(
        self,
        fetch: Callable[[], T],
        interval_s: float,
        on_result: Callable[[T], None],
        on_error: Callable[[BaseException], None] | None = None,
        on_loading: Callable[[bool], None] | None = None,
    ) -> None:
        self._fetch = fetch
        self.interval_s = interval_s
        self._on_result = on_result
        self._on_error = on_error
        self._on_loading = on_loading
        self._source: int | None = None
        self._task: Task[T] | None = None
        self._running = False

    @property
    def running(self) -> bool:
        return self._running

    def start(self, immediate: bool = True) -> "Poller[T]":
        if self._running:
            return self
        self._running = True
        if immediate:
            self.refresh()
        else:
            self._schedule()
        return self

    def stop(self) -> None:
        self._running = False
        self._clear_timer()
        if self._task:
            self._task.cancel()
            self._task = None
        if self._on_loading:
            self._on_loading(False)

    def refresh(self) -> None:
        self._clear_timer()
        if self._task and not self._task.done:
            return
        if self._on_loading:
            self._on_loading(True)
        self._task = run_async(
            self._fetch, on_success=self._handle_result, on_error=self._handle_error, on_done=self._handle_done
        )

    def set_interval(self, interval_s: float) -> None:
        self.interval_s = interval_s
        if self._running and self._source is not None:
            self._clear_timer()
            self._schedule()

    def bind(self, widget: Any) -> "Poller[T]":
        widget.connect("map", lambda *_: self.start())
        widget.connect("unmap", lambda *_: self.stop())
        if widget.get_mapped():
            self.start()
        return self

    def _handle_result(self, value: T) -> None:
        self._on_result(value)

    def _handle_error(self, error: BaseException) -> None:
        if self._on_error:
            self._on_error(error)

    def _handle_done(self) -> None:
        if self._on_loading:
            self._on_loading(False)
        if self._running:
            self._schedule()

    def _schedule(self) -> None:
        self._clear_timer()
        self._source = GLib.timeout_add(int(self.interval_s * 1000), self._tick)

    def _tick(self) -> bool:
        self._source = None
        if self._running:
            self.refresh()
        return GLib.SOURCE_REMOVE

    def _clear_timer(self) -> None:
        if self._source is not None:
            GLib.source_remove(self._source)
            self._source = None
