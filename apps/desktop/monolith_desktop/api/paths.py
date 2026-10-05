from ..pairing import build_query, encode_uri_component

API_PREFIX = "/v1"
UI_PREFIX = "/ui"
TICKET_PARAM = "ticket"


def _api(path: str) -> str:
    return f"{API_PREFIX}{path}"


def _seg(value: str) -> str:
    return encode_uri_component(value)


def _q(**params: object) -> str:
    return build_query({k: v for k, v in params.items() if v is not None})


class rest:
    health = staticmethod(lambda: _api("/health"))
    auth_ticket = staticmethod(lambda: _api("/auth/ticket"))
    status = staticmethod(lambda: _api("/status"))
    context = staticmethod(lambda: _api("/context"))
    identity = staticmethod(lambda: _api("/identity"))
    claude_auth = staticmethod(lambda: _api("/claude/auth"))
    claude_accounts = staticmethod(lambda: _api("/claude/accounts"))
    claude_default_account = staticmethod(lambda: _api("/claude/accounts/default"))
    stt = staticmethod(lambda: _api("/stt"))
    projects = staticmethod(lambda: _api("/projects"))
    project = staticmethod(lambda id, force=None: _api(f"/projects/{_seg(id)}{_q(force=force)}"))
    project_claude_account = staticmethod(lambda id: _api(f"/projects/{_seg(id)}/claude-account"))
    project_name = staticmethod(lambda id: _api(f"/projects/{_seg(id)}/name"))
    project_git = staticmethod(lambda id: _api(f"/projects/{_seg(id)}/git"))
    project_sync = staticmethod(lambda id, confidential=None: _api(f"/projects/{_seg(id)}/sync{_q(confidential=confidential)}"))
    project_sync_changes = staticmethod(lambda id: _api(f"/projects/{_seg(id)}/sync/changes"))
    project_sync_export = staticmethod(lambda id: _api(f"/projects/{_seg(id)}/sync/export"))
    project_sync_ack = staticmethod(lambda id: _api(f"/projects/{_seg(id)}/sync/ack"))
    project_sync_discard = staticmethod(lambda id: _api(f"/projects/{_seg(id)}/sync/discard"))
    project_sync_requests = staticmethod(lambda id: _api(f"/projects/{_seg(id)}/sync/requests"))
    sync_requests = staticmethod(lambda status=None: _api(f"/sync/requests{_q(status=status)}"))
    sync_request_claim = staticmethod(lambda id: _api(f"/sync/requests/{_seg(id)}/claim"))
    sync_request_complete = staticmethod(lambda id: _api(f"/sync/requests/{_seg(id)}/complete"))
    sync_request_cancel = staticmethod(lambda id: _api(f"/sync/requests/{_seg(id)}/cancel"))
    sync_request_plan = staticmethod(lambda id: _api(f"/sync/requests/{_seg(id)}/plan"))
    sync_request_apply = staticmethod(lambda id: _api(f"/sync/requests/{_seg(id)}/apply"))
    sync_heartbeat = staticmethod(lambda: _api("/sync/heartbeat"))
    processes = staticmethod(lambda project_id=None: _api(f"/processes{_q(projectId=project_id)}"))
    process = staticmethod(lambda id: _api(f"/processes/{_seg(id)}"))
    process_logs = staticmethod(lambda id, tail=None: _api(f"/processes/{_seg(id)}/logs{_q(tail=tail)}"))
    terminals = staticmethod(lambda: _api("/terminals"))
    terminal = staticmethod(lambda id: _api(f"/terminals/{_seg(id)}"))
    builds = staticmethod(lambda project_id=None: _api(f"/builds{_q(projectId=project_id)}"))
    build = staticmethod(lambda id: _api(f"/builds/{_seg(id)}"))
    build_logs = staticmethod(lambda id, tail=None: _api(f"/builds/{_seg(id)}/logs{_q(tail=tail)}"))
    artifacts = staticmethod(lambda project_id=None: _api(f"/artifacts{_q(projectId=project_id)}"))
    artifact = staticmethod(lambda id: _api(f"/artifacts/{_seg(id)}"))
    artifact_download = staticmethod(lambda id, ticket=None: _api(f"/artifacts/{_seg(id)}/download{_q(ticket=ticket)}"))
    artifact_taildrop = staticmethod(lambda id: _api(f"/artifacts/{_seg(id)}/taildrop"))
    build_outputs = staticmethod(lambda project_id=None: _api(f"/outputs{_q(projectId=project_id)}"))
    build_output_download = staticmethod(
        lambda project_id, path, ticket=None: _api(f"/projects/{_seg(project_id)}/outputs/download{_q(path=path, ticket=ticket)}")
    )
    uploads = staticmethod(lambda: _api("/uploads"))
    upload_content = staticmethod(lambda id: _api(f"/uploads/{_seg(id)}/content"))
    taildrop_targets = staticmethod(lambda: _api("/taildrop/targets"))
    ports = staticmethod(lambda: _api("/ports"))
    usage = staticmethod(lambda days=None: _api(f"/usage{_q(days=days)}"))
    sessions = staticmethod(lambda limit=None, project_id=None: _api(f"/sessions{_q(limit=limit, projectId=project_id)}"))
    inbox = staticmethod(lambda limit=None, unread=None: _api(f"/inbox{_q(limit=limit, unread=unread)}"))
    inbox_read = staticmethod(lambda: _api("/inbox/read"))
    project_run_targets = staticmethod(lambda id: _api(f"/projects/{_seg(id)}/run-targets"))
    project_app_runs = staticmethod(lambda id: _api(f"/projects/{_seg(id)}/app-runs"))
    app_runs = staticmethod(lambda project_id=None: _api(f"/app-runs{_q(projectId=project_id)}"))
    app_run = staticmethod(lambda id: _api(f"/app-runs/{_seg(id)}"))
    android = staticmethod(lambda: _api("/android"))
    display = staticmethod(lambda: _api("/display"))
    display_screenshot = staticmethod(lambda: _api("/display/screenshot"))
    display_windows = staticmethod(lambda: _api("/display/windows"))
    display_window_activate = staticmethod(lambda id: _api(f"/display/windows/{_seg(id)}/activate"))
    display_window_close = staticmethod(lambda id: _api(f"/display/windows/{_seg(id)}/close"))
    agent_runs = staticmethod(
        lambda project_id=None, archived=None: _api(f"/agent/runs{_q(projectId=project_id, archived=archived)}")
    )
    agent_runs_archive = staticmethod(lambda: _api("/agent/runs/archive"))
    agent_runs_delete = staticmethod(lambda: _api("/agent/runs/delete"))
    agent_run = staticmethod(lambda id: _api(f"/agent/runs/{_seg(id)}"))
    events = staticmethod(lambda: _api("/events"))


class ws:
    events = staticmethod(lambda: _api("/events"))
    terminal_stream = staticmethod(lambda id: _api(f"/terminals/{_seg(id)}/stream"))
    process_log_stream = staticmethod(lambda id: _api(f"/processes/{_seg(id)}/logs/stream"))
    build_log_stream = staticmethod(lambda id: _api(f"/builds/{_seg(id)}/logs/stream"))
    agent_run_stream = staticmethod(lambda id: _api(f"/agent/runs/{_seg(id)}/stream"))
    vnc = staticmethod(lambda: _api("/display/vnc"))


def _fragment(params: dict[str, object | None]) -> str:
    query = build_query(params)
    return f"#{query[1:]}" if query else ""


class ui:
    terminal = staticmethod(lambda ticket, session: f"{UI_PREFIX}/terminal{_fragment({'ticket': ticket, 'session': session})}")
    vnc = staticmethod(lambda ticket, password=None: f"{UI_PREFIX}/vnc{_fragment({'ticket': ticket, 'password': password})}")
