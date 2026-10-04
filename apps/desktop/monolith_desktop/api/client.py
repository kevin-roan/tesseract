import json
import socket
import urllib.error
import urllib.request
from typing import Any, BinaryIO, cast

from ..pairing import build_query, normalize_base_url, to_websocket_url
from . import types as T
from .errors import (
    NetworkError,
    ProtocolError,
    RequestTimeout,
    check_protocol_version,
    error_from_response,
)
from .paths import TICKET_PARAM, rest, ui

DEFAULT_TIMEOUT_S = 15.0
TAILDROP_TIMEOUT_S = 120.0
SYNC_TIMEOUT_S = 600.0
USER_AGENT = "monolith-desktop/0.1"


class ControllerClient:
    def __init__(self, base_url: str, token: str, timeout: float = DEFAULT_TIMEOUT_S) -> None:
        normalized = normalize_base_url(base_url)
        if not normalized:
            raise ValueError(f"Invalid controller URL: {base_url}")
        if not token:
            raise ValueError("A controller token is required")
        self.base_url = normalized
        self.timeout = timeout
        self._token = token

    def auth_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._token}"}

    def http_url(self, path: str) -> str:
        return f"{self.base_url}{path}"

    def ws_url(self, path: str, ticket: str) -> str:
        separator = "&" if "?" in path else "?"
        return f"{to_websocket_url(self.base_url)}{path}{separator}{build_query({TICKET_PARAM: ticket})[1:]}"

    def request_raw(
        self,
        method: str,
        path: str,
        body: Any = None,
        auth: bool = True,
        timeout: float | None = None,
        content: tuple[str, BinaryIO, int] | None = None,
    ) -> tuple[int, dict[str, str], bytes]:
        headers = {"Accept": "application/json", "User-Agent": USER_AGENT}
        data: bytes | BinaryIO | None = None
        if content is not None:
            content_type, data, length = content
            headers["Content-Type"] = content_type
            headers["Content-Length"] = str(length)
        elif body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if auth:
            headers.update(self.auth_headers())
        request = urllib.request.Request(self.http_url(path), data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=timeout or self.timeout) as response:
                return response.status, dict(response.headers.items()), response.read()
        except urllib.error.HTTPError as error:
            raise error_from_response(error.code, error.read()) from None
        except (TimeoutError, socket.timeout) as error:
            raise RequestTimeout(f"{method} {path} timed out") from error
        except urllib.error.URLError as error:
            if isinstance(error.reason, TimeoutError | socket.timeout):
                raise RequestTimeout(f"{method} {path} timed out") from error
            raise NetworkError(str(error.reason)) from error
        except (ConnectionError, OSError) as error:
            raise NetworkError(str(error)) from error

    def request(
        self,
        method: str,
        path: str,
        body: Any = None,
        auth: bool = True,
        timeout: float | None = None,
        content: tuple[str, BinaryIO, int] | None = None,
    ) -> Any:
        status, _headers, payload = self.request_raw(method, path, body, auth, timeout, content)
        if status == 202 or status == 204 or not payload:
            return None
        try:
            return json.loads(payload)
        except ValueError as error:
            raise ProtocolError(f"{path}: response is not JSON") from error

    def get(self, path: str, **kwargs: Any) -> Any:
        return self.request("GET", path, **kwargs)

    def post(self, path: str, body: Any = None, **kwargs: Any) -> Any:
        return self.request("POST", path, body if body is not None else {}, **kwargs)

    def put(self, path: str, body: Any = None, **kwargs: Any) -> Any:
        return self.request("PUT", path, body if body is not None else {}, **kwargs)

    def delete(self, path: str, **kwargs: Any) -> Any:
        return self.request("DELETE", path, **kwargs)

    def health(self, timeout: float | None = None) -> T.Health:
        health = self.get(rest.health(), auth=False, timeout=timeout)
        if not isinstance(health, dict) or "protocolVersion" not in health:
            raise ProtocolError("/v1/health: unexpected response")
        check_protocol_version(health.get("protocolVersion"))
        return cast(T.Health, health)

    def create_ticket(self) -> T.Ticket:
        return self.post(rest.auth_ticket())

    def status(self) -> T.SandboxStatus:
        return self.get(rest.status())

    def identity(self) -> T.Identity:
        return self.get(rest.identity())

    def claude_auth(self) -> T.ClaudeAuthStatus:
        return T.parse_claude_auth_status(self.get(rest.claude_auth()))

    def claude_accounts(self) -> T.ClaudeAccountList:
        return T.parse_claude_account_list(self.get(rest.claude_accounts()))

    def set_default_claude_account(self, account_id: str) -> T.ClaudeAccountList:
        return T.parse_claude_account_list(self.put(rest.claude_default_account(), {"accountId": account_id}))

    def stt_status(self) -> T.SttStatus:
        return T.parse_stt_status(self.get(rest.stt()))

    def set_stt_profile(self, profile: str) -> T.SttStatus:
        if profile not in T.STT_PROFILES:
            raise ValueError(f"Unknown speech-to-text profile: {profile}")
        return T.parse_stt_status(self.put(rest.stt(), {"profile": profile}))

    def context(self) -> T.AgentContext:
        return self.get(rest.context())

    def ports(self) -> T.ListeningPorts:
        return self.get(rest.ports())

    def usage(self, days: int | None = None) -> T.UsageReport:
        return self.get(rest.usage(days))

    def sessions(self, limit: int | None = None, project_id: str | None = None) -> list[T.ClaudeSession]:
        return self.get(rest.sessions(limit, project_id))

    def inbox(self, limit: int | None = None, unread: bool | None = None) -> T.Inbox:
        return self.get(rest.inbox(limit, "1" if unread else None))

    def mark_inbox_read(self, ids: list[str] | None = None) -> T.InboxCounts:
        return self.post(rest.inbox_read(), {"all": True} if ids is None else {"ids": ids})

    def list_projects(self) -> list[T.Project]:
        return self.get(rest.projects())

    def create_project(
        self, name: str, git_url: str | None = None, branch: str | None = None, confidential: bool = False
    ) -> T.CreateProjectResponse:
        body: dict[str, Any] = {"name": name}
        if git_url:
            body["gitUrl"] = git_url
        if branch:
            body["branch"] = branch
        if confidential:
            body["confidential"] = True
        return self.post(rest.projects(), body)

    def get_project(self, id: str) -> T.Project:
        return self.get(rest.project(id))

    def set_project_claude_account(self, id: str, account_id: str | None) -> T.Project:
        return self.put(rest.project_claude_account(id), {"accountId": account_id})

    def get_project_git(self, id: str) -> T.GitDetails:
        return self.get(rest.project_git(id))

    def sync_project(self, id: str, archive: BinaryIO, size: int, confidential: bool = False) -> tuple[T.Project, bool]:
        """Extracts a gzip tar over the project; returns the project and whether it was created."""
        path = rest.project_sync(id, 1 if confidential else None)
        status, _headers, payload = self.request_raw("POST", path, content=("application/gzip", archive, size), timeout=SYNC_TIMEOUT_S)
        try:
            return json.loads(payload), status == 201
        except ValueError as error:
            raise ProtocolError(f"{path}: response is not JSON") from error

    def sync_changes(self, project_id: str) -> T.SyncChanges:
        return self.get(rest.project_sync_changes(project_id))

    def sync_export(self, project_id: str, paths: list[str]) -> bytes:
        """A gzip tar of the current sandbox content of `paths` (each a current added/modified change)."""
        return self.request_raw("POST", rest.project_sync_export(project_id), {"paths": list(paths)}, timeout=SYNC_TIMEOUT_S)[2]

    def sync_ack(self, project_id: str, changes: list[dict[str, Any]]) -> T.SyncChanges:
        return self.post(rest.project_sync_ack(project_id), {"changes": changes})

    def sync_discard(self, project_id: str, paths: list[str] | None = None) -> T.SyncDiscardResult:
        """Restores the sandbox files of `paths` (default: every change) to the sync baseline."""
        return self.post(rest.project_sync_discard(project_id), {"paths": list(paths)} if paths else {}, timeout=SYNC_TIMEOUT_S)

    def list_sync_requests(self, project_id: str) -> list[T.SyncRequest]:
        return self.get(rest.project_sync_requests(project_id))

    def create_sync_request(
        self,
        project_id: str,
        kind: T.SyncRequestKind,
        paths: list[str] | None = None,
        force: bool = False,
        source: T.SyncSource = "desktop",
    ) -> T.SyncRequest:
        body: dict[str, Any] = {"kind": kind, "force": force, "source": source}
        if paths:
            body["paths"] = list(paths)
        return self.post(rest.project_sync_requests(project_id), body)

    def pending_sync_requests(self) -> list[T.SyncRequest]:
        return self.get(rest.sync_requests("pending"))

    def claim_sync_request(self, request_id: str, host: str) -> T.SyncRequest:
        return self.post(rest.sync_request_claim(request_id), {"host": host})

    def complete_sync_request(
        self, request_id: str, status: str, result: T.SyncResult | dict[str, Any] | None = None, error: str | None = None
    ) -> T.SyncRequest:
        body: dict[str, Any] = {"status": status}
        if result is not None:
            body["result"] = result
        if error:
            body["error"] = error
        return self.post(rest.sync_request_complete(request_id), body)

    def cancel_sync_request(self, request_id: str) -> T.SyncRequest:
        return self.post(rest.sync_request_cancel(request_id))

    def sync_get_plan(self, request_id: str, plan: T.SyncGetPlan | dict[str, Any]) -> T.SyncGetPlanResponse:
        return self.post(rest.sync_request_plan(request_id), plan, timeout=SYNC_TIMEOUT_S)

    def sync_get_apply(self, request_id: str, archive: BinaryIO, size: int) -> T.SyncRequest:
        """Uploads the gzip tar of a planned get (exactly `upload` + `.git/<gitUpload>`)."""
        return self.request("POST", rest.sync_request_apply(request_id), content=("application/gzip", archive, size), timeout=SYNC_TIMEOUT_S)

    def sync_heartbeat(self, host: str, projects: list[str]) -> None:
        self.post(rest.sync_heartbeat(), {"host": host, "projects": list(projects)})

    def list_processes(self, project_id: str | None = None) -> list[T.ProcessInfo]:
        return self.get(rest.processes(project_id))

    def start_process(self, body: dict[str, Any]) -> T.ProcessInfo:
        return self.post(rest.processes(), body)

    def get_process(self, id: str) -> T.ProcessInfo:
        return self.get(rest.process(id))

    def stop_process(self, id: str) -> T.ProcessInfo:
        return self.delete(rest.process(id))

    def process_logs(self, id: str, tail: int | None = None) -> list[T.LogLine]:
        return self.get(rest.process_logs(id, tail))

    def list_terminals(self) -> list[T.TerminalInfo]:
        return self.get(rest.terminals())

    def create_terminal(self, kind: str, cols: int, rows: int, project_id: str | None = None) -> T.TerminalInfo:
        body: dict[str, Any] = {"kind": kind, "cols": cols, "rows": rows}
        if project_id:
            body["projectId"] = project_id
        return self.post(rest.terminals(), body)

    def close_terminal(self, id: str) -> T.TerminalInfo:
        return self.delete(rest.terminal(id))

    def list_builds(self, project_id: str | None = None) -> list[T.BuildJob]:
        return self.get(rest.builds(project_id))

    def start_build(self, project_id: str, target: str, profile: str | None = None) -> T.BuildJob:
        body = {"projectId": project_id, "target": target}
        if profile:
            body["profile"] = profile
        return self.post(rest.builds(), body)

    def get_build(self, id: str) -> T.BuildJob:
        return self.get(rest.build(id))

    def cancel_build(self, id: str) -> T.BuildJob:
        return self.delete(rest.build(id))

    def build_logs(self, id: str, tail: int | None = None) -> list[T.LogLine]:
        return self.get(rest.build_logs(id, tail))

    def list_artifacts(self, project_id: str | None = None) -> list[T.Artifact]:
        return self.get(rest.artifacts(project_id))

    def delete_artifact(self, id: str) -> T.Artifact:
        return self.delete(rest.artifact(id))

    def taildrop_targets(self) -> T.TaildropTargets:
        return self.get(rest.taildrop_targets())

    def send_artifact_taildrop(self, id: str, target_id: str) -> T.Artifact:
        return self.post(rest.artifact_taildrop(id), {"targetId": target_id}, timeout=TAILDROP_TIMEOUT_S)

    def display_status(self) -> T.DisplayStatus:
        return self.get(rest.display())

    def screenshot(self) -> bytes:
        return self.request_raw("GET", rest.display_screenshot())[2]

    def list_agent_runs(self, project_id: str | None = None, archived: bool = False) -> list[T.AgentRun]:
        return self.get(rest.agent_runs(project_id, "1" if archived else None))

    def archive_agent_runs(
        self,
        ids: list[str] | None = None,
        archived: bool = True,
        all_runs: bool = False,
        project_id: str | None = None,
    ) -> T.CountResult:
        body = _run_selection(ids, all_runs, project_id)
        body["archived"] = archived
        return self.post(rest.agent_runs_archive(), body)

    def delete_agent_runs(
        self,
        ids: list[str] | None = None,
        all_runs: bool = False,
        project_id: str | None = None,
        archived: bool | None = None,
    ) -> T.CountResult:
        body = _run_selection(ids, all_runs, project_id)
        if all_runs and archived is not None:
            body["archived"] = archived
        return self.post(rest.agent_runs_delete(), body)

    def start_agent_run(self, prompt: str, project_id: str | None = None, resume_session_id: str | None = None) -> T.AgentRun:
        body: dict[str, Any] = {"prompt": prompt}
        if project_id:
            body["projectId"] = project_id
        if resume_session_id:
            body["resumeSessionId"] = resume_session_id
        return self.post(rest.agent_runs(), body)

    def get_agent_run(self, id: str) -> T.AgentRunDetail:
        return self.get(rest.agent_run(id))

    def cancel_agent_run(self, id: str) -> T.AgentRun:
        return self.delete(rest.agent_run(id))

    def publish_status(self, event: dict[str, Any]) -> None:
        self.post(rest.events(), event)

    def terminal_page_url(self, session_id: str) -> str:
        return self.http_url(ui.terminal(self.create_ticket()["ticket"], session_id))

    def vnc_page_url(self) -> str:
        password = self.display_status()["vnc"]["password"]
        return self.http_url(ui.vnc(self.create_ticket()["ticket"], password))

    def artifact_download_url(self, id: str) -> str:
        return self.http_url(rest.artifact_download(id, self.create_ticket()["ticket"]))


def _run_selection(ids: list[str] | None, all_runs: bool, project_id: str | None) -> dict[str, Any]:
    if all_runs:
        body: dict[str, Any] = {"all": True}
        if project_id:
            body["projectId"] = project_id
        return body
    if not ids:
        raise ValueError("Pass run ids or all_runs=True")
    return {"ids": list(ids)}
