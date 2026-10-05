from typing import TYPE_CHECKING

from gi.repository import Gtk

from ...api.types import BuildJob, Project
from ...widgets.buttons import ChipGroup
from ...widgets.confirm_dialog import confirm
from ...widgets.keyed_list import KeyedList
from ...widgets.log_panel import LogPanel
from ...widgets.record_row import RecordRow, RowAction
from ...widgets.list_view import ListGroup
from .labels import BUILD_PROFILES, BUILDS, LOGS
from .model import (
    build_meta,
    build_progress,
    build_state,
    is_final_build,
    profile_label,
    target_label,
    target_platform,
)
from .streams import LogFollower

if TYPE_CHECKING:
    from .detail import ProjectDetail

TAB_SPACING = 16
DEFAULT_PROFILE = "debug"


class BuildsTab:
    def __init__(self, host: "ProjectDetail") -> None:
        self._host = host
        self._project: Project | None = None
        self._builds: list[BuildJob] = []
        self._pending: set[str] = set()
        self._profile = DEFAULT_PROFILE
        self.widget = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=TAB_SPACING)

        self._targets = KeyedList(lambda: RecordRow("builds"), self._update_target)
        self._targets.add_css_class("divided")
        self._targets_section = ListGroup(
            BUILDS["targets"], self._targets, empty_label=BUILDS["targets_empty"], subtitle=BUILDS["targets_subtitle"],
            icon="builds",
        )
        self._profiles = ChipGroup(list(BUILD_PROFILES.items()), DEFAULT_PROFILE, self._set_profile)
        self._profiles.set_valign(Gtk.Align.CENTER)
        self._profiles.set_halign(Gtk.Align.END)
        self._targets_section.header.add_trailing(self._profiles)
        self.widget.append(self._targets_section)

        self._jobs = KeyedList(lambda: RecordRow("builds"), self._update_job)
        self._jobs.add_css_class("divided")
        self._jobs_section = ListGroup(BUILDS["jobs"], self._jobs, empty_label=BUILDS["jobs_empty"], icon="sessions")
        self.widget.append(self._jobs_section)

        self._panel = LogPanel(LOGS["close"], self._hide_logs, LOGS["empty"], LOGS["jump"])
        self._panel.set_visible(False)
        self.widget.append(self._panel)
        self._follower = LogFollower(host.ctx, self._panel, on_update=lambda item: host.upsert("builds", item)).bind(self._panel)

    @property
    def active(self) -> int:
        return sum(1 for build in self._builds if not is_final_build(build))

    def render(self, project: Project | None, builds: list[BuildJob] | None) -> None:
        self._project = project
        if project:
            targets = project.get("buildTargets", [])
            self._targets.sync((target, target) for target in targets)
            self._targets_section.set_empty(not targets)
            self._profiles.set_visible(bool(targets))
        if builds is None:
            self._jobs_section.set_loading(True)
            return
        self._builds = builds
        self._jobs_section.set_loading(False)
        self._rerender()

    def _rerender(self) -> None:
        self._jobs.sync((build["id"], build) for build in self._builds)
        self._jobs_section.set_empty(not self._builds)
        self._jobs_section.set_count(len(self._builds))
        if self._project:
            self._targets.sync((target, target) for target in self._project.get("buildTargets", []))

    def _set_profile(self, profile: str) -> None:
        self._profile = profile

    def _update_target(self, row: RecordRow, target: str) -> None:
        row.set_content(target_label(target), " · ".join(filter(None, [target_platform(target), target])))
        row.set_actions([RowAction("build", "play", BUILDS["build"], lambda: self._start(target), target not in self._pending, labeled=True)])

    def _update_job(self, row: RecordRow, build: BuildJob) -> None:
        label, tone = build_state(build)
        row.set_content(target_label(build["target"]), build.get("error"), build_meta(build))
        row.set_status(label, tone, glyph=True)
        row.set_progress(build_progress(build), not is_final_build(build))
        open_logs = self._panel.get_visible() and self._follower.target == ("build", build["id"])
        actions = [RowAction(
            "logs", "terminal", BUILDS["hide_logs"] if open_logs else BUILDS["logs"],
            lambda: self._toggle_logs(build), active=open_logs,
        )]
        if not is_final_build(build):
            actions.append(RowAction(
                "cancel", "stop", BUILDS["cancel"], lambda: self._confirm_cancel(build),
                build["id"] not in self._pending, destructive=True,
            ))
        row.set_actions(actions)
        row.set_on_activate(lambda: self._toggle_logs(build))

    def _toggle_logs(self, build: BuildJob) -> None:
        if self._panel.get_visible() and self._follower.target == ("build", build["id"]):
            self._hide_logs()
        else:
            self.show_logs(build)

    def show_logs(self, build: BuildJob) -> None:
        self._panel.set_title(BUILDS["logs_title"].format(target=target_label(build["target"])))
        self._panel.set_status(None)
        self._panel.set_visible(True)
        self._follower.follow("build", build["id"])
        self._rerender()

    def _hide_logs(self) -> None:
        self._follower.stop()
        self._panel.set_visible(False)
        self._rerender()

    def _start(self, target: str) -> None:
        project = self._project
        if project is None or target in self._pending:
            return
        profile = self._profile
        self._pending.add(target)
        self._rerender()

        def done() -> None:
            self._pending.discard(target)
            self._rerender()

        self._host.ctx.call(lambda client: client.start_build(project["id"], target, profile), self._started, self._host.report, done)

    def _started(self, build: BuildJob) -> None:
        self._host.upsert("builds", build)
        self._host.ctx.toast(BUILDS["started"].format(target=target_label(build["target"])))
        self.show_logs(build)

    def _confirm_cancel(self, build: BuildJob) -> None:
        confirm(
            self._host.ctx.window, BUILDS["cancel_title"],
            BUILDS["cancel_body"].format(target=target_label(build["target"]), profile=profile_label(build.get("profile", ""))),
            BUILDS["cancel_confirm"], BUILDS["keep"], lambda: self._cancel(build),
        )

    def _cancel(self, build: BuildJob) -> None:
        self._pending.add(build["id"])
        self._rerender()

        def done() -> None:
            self._pending.discard(build["id"])
            self._rerender()

        self._host.ctx.call(
            lambda client: client.cancel_build(build["id"]),
            lambda updated: self._host.upsert("builds", updated),
            self._host.report,
            done,
        )
