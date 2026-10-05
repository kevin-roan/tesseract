from typing import TYPE_CHECKING

from gi.repository import Gtk

from ...api.types import ListeningPort, ListeningPorts, ProcessInfo, Project
from ...widgets.confirm_dialog import confirm
from ...widgets.desktop import copy_text, open_uri
from ...widgets.keyed_list import KeyedList
from ...widgets.log_panel import LogPanel
from ...widgets.record_row import RecordRow, RowAction
from ...widgets.list_view import ListGroup
from .labels import DEFAULT_PACKAGE_MANAGER, LOGS, PROCESSES
from .model import (
    command_label,
    host_of,
    is_live_process,
    prefers_display,
    process_meta,
    process_state,
    project_ports,
    script_command,
    site_url,
)
from .run_dialog import RunCommandDialog
from .streams import LogFollower

if TYPE_CHECKING:
    from .detail import ProjectDetail

TAB_SPACING = 16
PORTS_INTERVAL_S = 10.0


class ProcessesTab:
    def __init__(self, host: "ProjectDetail") -> None:
        self._host = host
        self._project: Project | None = None
        self._processes: list[ProcessInfo] = []
        self._ports: list[ListeningPort] = []
        self._pending: set[str] = set()
        self.widget = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=TAB_SPACING)

        self._sites = KeyedList(lambda: RecordRow("ports"), self._update_site)
        self._sites.add_css_class("divided")
        self._sites_section = ListGroup(PROCESSES["sites"], self._sites, subtitle=PROCESSES["sites_subtitle"], icon="ports")
        self._sites_section.set_visible(False)
        self.widget.append(self._sites_section)


        self._list = KeyedList(lambda: RecordRow("processes", monospace_subtitle=True), self._update_process)
        self._list.add_css_class("divided")
        self._list_section = ListGroup(
            PROCESSES["list"], self._list, PROCESSES["new"], self._new_command, PROCESSES["list_empty"], icon="processes"
        )
        self.widget.append(self._list_section)

        self._panel = LogPanel(LOGS["close"], self._hide_logs, LOGS["empty"], LOGS["jump"])
        self._panel.set_visible(False)
        self.widget.append(self._panel)
        self._scripts = KeyedList(lambda: RecordRow("terminal", monospace_title=True, monospace_subtitle=True), self._update_script)
        self._scripts.add_css_class("divided")
        self._scripts_section = ListGroup(PROCESSES["scripts"], self._scripts, icon="terminal")
        self._scripts_section.set_visible(False)
        self.widget.append(self._scripts_section)
        self._follower = LogFollower(host.ctx, self._panel, on_update=lambda item: host.upsert("processes", item)).bind(self._panel)
        host.ctx.poll(lambda client: client.ports(), PORTS_INTERVAL_S, self._ports_loaded).bind(self.widget)

    @property
    def running(self) -> int:
        return sum(1 for process in self._processes if is_live_process(process))

    def render(self, project: Project | None, processes: list[ProcessInfo] | None) -> None:
        self._project = project
        if project:
            scripts = project.get("scripts", [])
            self._scripts.sync((script, script) for script in scripts)
            self._scripts_section.set_visible(bool(scripts))
            self._scripts_section.set_count(len(scripts))
            self._scripts_section.header.set_subtitle(
                PROCESSES["scripts_subtitle"].format(pm=project.get("packageManager") or DEFAULT_PACKAGE_MANAGER)
            )
        if processes is None:
            self._list_section.set_loading(True)
            return
        self._processes = processes
        self._list_section.set_loading(False)
        self._list.sync((process["id"], process) for process in processes)
        self._list_section.set_empty(not processes)
        self._list_section.set_count(len(processes))
        target = self._follower.target
        if target and self._panel.get_visible():
            current = next((p for p in processes if p["id"] == target[1]), None)
            if current:
                self._panel.set_title(PROCESSES["logs_title"].format(name=current["name"]))

    def _ports_loaded(self, ports: ListeningPorts) -> None:
        self._ports = project_ports(ports.get("ports"), self._host.project_id)
        self._sites.sync((str(port["port"]), port) for port in self._ports)
        self._sites_section.set_visible(bool(self._ports))
        self._sites_section.set_count(len(self._ports))

    def _fallback_host(self) -> str | None:
        client = self._host.ctx.client
        return host_of(client.base_url) if client else None

    def _update_site(self, row: RecordRow, port: ListeningPort) -> None:
        url = site_url(port, self._fallback_host())
        row.set_content(PROCESSES["port"].format(port=port["port"]), port.get("command"), url or PROCESSES["no_url"])
        actions = []
        if url:
            actions = [
                RowAction("copy", "copy", PROCESSES["copy"], lambda: self._copy(url)),
                RowAction("open", "browser", PROCESSES["open"], lambda: self._open(url)),
            ]
        row.set_actions(actions)
        row.set_on_activate((lambda: self._open(url)) if url else None)

    def _update_script(self, row: RecordRow, script: str) -> None:
        pm = (self._project or {}).get("packageManager")
        row.set_content(script, script_command(pm, script))
        busy = script in self._pending
        row.set_actions([
            RowAction("display", "display", PROCESSES["run_display"], lambda: self._run_script(script, True), not busy),
            RowAction("run", "play", PROCESSES["run"], lambda: self._run_script(script, None), not busy, labeled=True),
        ])

    def _update_process(self, row: RecordRow, process: ProcessInfo) -> None:
        label, tone = process_state(process)
        row.set_content(process.get("name") or process["id"], command_label(process.get("command", "")), process_meta(process))
        row.set_status(label, tone, glyph=True)
        open_logs = self._panel.get_visible() and self._follower.target == ("process", process["id"])
        actions = [
            RowAction(
                "logs", "terminal", PROCESSES["hide_logs"] if open_logs else PROCESSES["logs"],
                lambda: self._toggle_logs(process), active=open_logs,
            ),
        ]
        if is_live_process(process):
            actions.append(RowAction(
                "stop", "stop", PROCESSES["stop"], lambda: self._confirm_stop(process),
                process["id"] not in self._pending, destructive=True,
            ))
        row.set_actions(actions)
        row.set_on_activate(lambda: self._toggle_logs(process))

    def _toggle_logs(self, process: ProcessInfo) -> None:
        if self._panel.get_visible() and self._follower.target == ("process", process["id"]):
            self._hide_logs()
        else:
            self.show_logs(process)

    def show_logs(self, process: ProcessInfo) -> None:
        self._panel.set_title(PROCESSES["logs_title"].format(name=process.get("name") or process["id"]))
        self._panel.set_status(None)
        self._panel.set_visible(True)
        self._follower.follow("process", process["id"])
        self._rerender()

    def _hide_logs(self) -> None:
        self._follower.stop()
        self._panel.set_visible(False)
        self._rerender()

    def _rerender(self) -> None:
        self._list.sync((process["id"], process) for process in self._processes)

    def _confirm_stop(self, process: ProcessInfo) -> None:
        name = process.get("name") or process["id"]
        confirm(
            self._host.ctx.window, PROCESSES["stop_title"].format(name=name), PROCESSES["stop_body"],
            PROCESSES["stop_confirm"], PROCESSES["cancel"], lambda: self._stop(process),
        )

    def _stop(self, process: ProcessInfo) -> None:
        self._pending.add(process["id"])
        self._rerender()

        def done() -> None:
            self._pending.discard(process["id"])
            self._rerender()

        def stopped(updated: ProcessInfo) -> None:
            self._host.upsert("processes", updated)
            self._host.ctx.toast(PROCESSES["stopped"].format(name=updated.get("name") or updated["id"]))

        self._host.ctx.call(lambda client: client.stop_process(process["id"]), stopped, self._host.report, done)

    def _run_script(self, script: str, display: bool | None) -> None:
        project = self._project
        if project is None or script in self._pending:
            return
        body = {
            "projectId": project["id"],
            "command": script_command(project.get("packageManager"), script),
            "name": script,
            "display": prefers_display(project.get("framework", "")) if display is None else display,
        }
        self._pending.add(script)
        self._scripts.sync((s, s) for s in project.get("scripts", []))

        def done() -> None:
            self._pending.discard(script)
            if self._project:
                self._scripts.sync((s, s) for s in self._project.get("scripts", []))

        self._host.ctx.call(lambda client: client.start_process(body), self._started, self._host.report, done)

    def _new_command(self) -> None:
        if self._project is not None:
            RunCommandDialog(self._host.ctx, self._project, self._started).present()

    def _started(self, process: ProcessInfo) -> None:
        self._host.upsert("processes", process)
        self._host.ctx.toast(PROCESSES["started"].format(name=process.get("name") or process["id"]))
        self.show_logs(process)

    def _open(self, url: str) -> None:
        open_uri(self._host.ctx.window, url, self._host.report)

    def _copy(self, url: str) -> None:
        copy_text(self.widget, url)
        self._host.ctx.toast(PROCESSES["copied"])
