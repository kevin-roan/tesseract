import logging
import threading
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Generic, TypeVar

from gi.repository import GLib

R = TypeVar("R")

log = logging.getLogger(__name__)
_executor = ThreadPoolExecutor(max_workers=8, thread_name_prefix="monolith-io")


class Task(Generic[R]):
    def __init__(self) -> None:
        self._cancelled = threading.Event()
        self.done = False

    @property
    def cancelled(self) -> bool:
        return self._cancelled.is_set()

    def cancel(self) -> None:
        self._cancelled.set()


def _deliver(callback: Callable[..., Any] | None, *args: Any) -> None:
    if callback is None:
        return
    try:
        callback(*args)
    except Exception:
        log.exception("task callback failed")


def run_async(
    fn: Callable[..., R],
    *args: Any,
    on_success: Callable[[R], None] | None = None,
    on_error: Callable[[BaseException], None] | None = None,
    on_done: Callable[[], None] | None = None,
    **kwargs: Any,
) -> Task[R]:
    task: Task[R] = Task()

    def finish(ok: bool, value: Any) -> bool:
        task.done = True
        if task.cancelled:
            return GLib.SOURCE_REMOVE
        if ok:
            _deliver(on_success, value)
        elif on_error is not None:
            _deliver(on_error, value)
        else:
            log.warning("unhandled task error: %r", value)
        _deliver(on_done)
        return GLib.SOURCE_REMOVE

    def work() -> None:
        if task.cancelled:
            return
        try:
            result = fn(*args, **kwargs)
        except BaseException as error:  # noqa: BLE001
            GLib.idle_add(finish, False, error)
            return
        GLib.idle_add(finish, True, result)

    _executor.submit(work)
    return task


def run_in_thread(fn: Callable[..., Any], *args: Any, **kwargs: Any) -> None:
    _executor.submit(fn, *args, **kwargs)


def call_on_main(fn: Callable[..., Any], *args: Any) -> None:
    def invoke() -> bool:
        _deliver(fn, *args)
        return GLib.SOURCE_REMOVE

    GLib.idle_add(invoke)


def shutdown() -> None:
    _executor.shutdown(wait=False, cancel_futures=True)
