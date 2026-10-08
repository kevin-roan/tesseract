import logging
from dataclasses import dataclass
from typing import Any, Protocol

from .errors import SyncBackError, SyncConflict
from .get import GetClient, get
from .pull import SyncClient, pull
from .revert import restore_baseline, revert
from .state import SyncState
from .summary import describe_result

log = logging.getLogger(__name__)


class RequestClient(SyncClient, GetClient, Protocol):
    def claim_sync_request(self, request_id: str, host: str) -> dict[str, Any]: ...
    def complete_sync_request(
        self, request_id: str, status: str, result: dict[str, Any] | None = None, error: str | None = None
    ) -> dict[str, Any]: ...


@dataclass(frozen=True)
class Handled:
    request: dict[str, Any]
    ok: bool
    message: str
    result: dict[str, Any] | None


def claimable(request: dict[str, Any], state: SyncState) -> bool:
    return request.get("status") == "pending" and request.get("projectId") in state.links()


def empty_result(host_path: str | None, conflicts: list[str] | None = None) -> dict[str, Any]:
    return {"added": 0, "modified": 0, "deleted": 0, "conflicts": conflicts or [], "snapshotId": None, "hostPath": host_path}


def handle_request(client: RequestClient, state: SyncState, request: dict[str, Any], host: str) -> Handled:
    """Claim a pending request, apply it with the sync-back (or get) engine and complete it."""
    claimed = client.claim_sync_request(request["id"], host)
    link = state.link(claimed["projectId"])
    host_path = link.shared_path if link else None
    redact = link.redact if link else str
    try:
        if claimed["kind"] == "get":
            return _finished(get(client, state, claimed))
        result = _apply(client, state, claimed)
    except SyncConflict as error:
        return _fail(client, claimed, redact(str(error)), empty_result(host_path, error.conflicts))
    except Exception as error:  # noqa: BLE001
        log.warning("sync request %s failed", claimed["id"], exc_info=not isinstance(error, SyncBackError))
        return _fail(client, claimed, redact(str(error) or type(error).__name__), empty_result(host_path))
    if link is not None and link.confidential:
        result["hostPath"] = host_path
    done = client.complete_sync_request(claimed["id"], "applied", result=result)
    return Handled(done, True, describe_result(claimed["kind"], result), result)


def _apply(client: RequestClient, state: SyncState, claimed: dict[str, Any]) -> dict[str, Any]:
    project_id, force = claimed["projectId"], bool(claimed.get("force"))
    if claimed["kind"] == "revert":
        outcome = revert(state, project_id, force)
        restore_baseline(client, outcome)
        return outcome.result()
    return pull(client, state, project_id, claimed.get("paths"), force).result()


def _finished(done: dict[str, Any]) -> Handled:
    """A get the controller already completed: applied, or failed on conflicts."""
    result = done.get("result")
    if done["status"] == "applied":
        return Handled(done, True, describe_result("get", dict(result or {})), result)
    return Handled(done, False, done.get("error") or "The sandbox refused the changes", result)


def _fail(client: RequestClient, request: dict[str, Any], message: str, result: dict[str, Any]) -> Handled:
    done = client.complete_sync_request(request["id"], "failed", result=result, error=message)
    return Handled(done, False, message, result)
