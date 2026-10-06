from collections.abc import Callable
from typing import TYPE_CHECKING

from gi.repository import Gtk

from ...api.client import ControllerClient
from ...api.errors import NotConfigured, describe_error
from ...api.tasks import call_on_main, run_async
from ...api.types import AppRun, HostAndroidStatus, RunTargetInfo
from ...hostshell.android import HostAndroidClient, HostRequestError
from ...widgets.confirm_dialog import confirm
from ...widgets.host_unlock_dialog import HostUnlockDialog
from .emulator import EmulatorPlan, Stage, host_blocker, host_fixable, plan_emulator, prepare_emulator, run_on_emulator
from .labels import EMULATOR

if TYPE_CHECKING:
    from ...context import AppContext

Report = Callable[[str, tuple[str, Callable[[], None]] | None], None]


class EmulatorLauncher:
    """Opens a project's Android target on the host emulator. When only the emulator is missing (not running,
    not linked, not isolated) it starts and links one through the local host shell first."""

    def __init__(
        self,
        ctx: "AppContext",
        project_id: str,
        parent: Gtk.Widget,
        report: Report,
        set_busy: Callable[[bool, str | None], None],
        on_run: Callable[[tuple[AppRun, bool, str | None]], None],
    ) -> None:
        self.ctx = ctx
        self.project_id = project_id
        self._parent = parent
        self._report = report
        self._set_busy = set_busy
        self._on_run = on_run

    def launch(self, target: RunTargetInfo) -> None:
        if target["available"]:
            self._set_busy(True, None)
            self.ctx.call(
                lambda client: run_on_emulator(client, self.project_id, target["target"]),
                self._on_run,
                self._failed,
                lambda: self._set_busy(False, None),
            )
        elif not host_fixable(target):
            self._report(EMULATOR["unavailable"].format(reason=target["reason"]), None)
        else:
            self._with_host(target)

    def _with_host(self, target: RunTargetInfo) -> None:
        service = self.ctx.host_shell
        blocker = host_blocker(service.state.value)
        if blocker is not None:
            service.refresh()
            self._report(blocker, (EMULATOR["preferences"], lambda: self.ctx.open_preferences("host-shell")))
            return
        host = service.android_client()
        if host is None:
            HostUnlockDialog(self.ctx, lambda: self._with_host(target)).present(self._parent)
            return
        self._set_busy(True, EMULATOR["progress"]["checking"])
        run_async(
            host.status,
            on_success=lambda status: self._planned(target, host, status),
            on_error=lambda error: self._host_failed(target, error),
        )

    def _host_failed(self, target: RunTargetInfo, error: BaseException) -> None:
        self._set_busy(False, None)
        if isinstance(error, HostRequestError) and error.auth:
            self.ctx.host_shell.forget_session()
            self._with_host(target)
            return
        self._report(EMULATOR["host_failed"].format(error=error), None)

    def _planned(self, target: RunTargetInfo, host: HostAndroidClient, status: HostAndroidStatus) -> None:
        self._set_busy(False, None)
        client = self.ctx.client
        if client is None:
            self._failed(NotConfigured())
            return
        plan = plan_emulator(status, client.base_url)
        if plan.blocked:
            self._report(EMULATOR["unavailable"].format(reason=plan.blocked), None)
            return
        self._confirm(plan, lambda: self._prepare(target, host, plan))

    def _confirm(self, plan: EmulatorPlan, proceed: Callable[[], None]) -> None:
        if plan.stop:
            body = EMULATOR["restart_body"].format(avd=plan.avd)
            then = lambda: self._confirm(EmulatorPlan(replaces=plan.replaces), proceed)
            confirm(self._parent, EMULATOR["restart_title"], body, EMULATOR["restart_confirm"], EMULATOR["cancel"], then)
        elif plan.replaces:
            body = EMULATOR["relink_body"].format(url=plan.replaces)
            confirm(self._parent, EMULATOR["relink_title"], body, EMULATOR["relink_confirm"], EMULATOR["cancel"], proceed, False)
        else:
            proceed()

    def _prepare(self, target: RunTargetInfo, host: HostAndroidClient, plan: EmulatorPlan) -> None:
        def progress(stage: Stage) -> None:
            call_on_main(self._progress, stage)

        def work(client: ControllerClient) -> tuple[AppRun, bool, str | None]:
            prepare_emulator(host, client, self.project_id, target["target"], plan, progress)
            return run_on_emulator(client, self.project_id, target["target"])

        self._set_busy(True, None)
        self.ctx.call(work, self._on_run, self._failed, lambda: self._set_busy(False, None))

    def _progress(self, stage: Stage) -> None:
        label = EMULATOR["progress"][stage]
        self._set_busy(True, label)
        if stage != "booting":
            self.ctx.toast(label)

    def _failed(self, error: BaseException) -> None:
        if isinstance(error, HostRequestError):
            if error.auth:
                self.ctx.host_shell.forget_session()
            self._report(EMULATOR["host_failed"].format(error=error), None)
        else:
            self._report(EMULATOR["failed"].format(error=describe_error(error)), None)
