import logging
from dataclasses import dataclass
from typing import Any, Protocol

from .errors import SyncBackError, SyncConflict
from .pull import SyncClient, pull
from .revert import restore_baseline, revert
from .state import SyncState
from .summary import describe_result

log = logging.getLogger(__name__)


class RequestClient(SyncClient, Protocol):
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
    """Claim a pending request, apply it with the sync-back engine and complete it."""
    claimed = client.claim_sync_request(request["id"], host)
    project_id = claimed["projectId"]
    link = state.link(project_id)
    host_path = link.host_path if link else None
    try:
        if claimed["kind"] == "revert":
            outcome = revert(state, project_id, bool(claimed.get("force")))
            restore_baseline(client, outcome)
            result = outcome.result()
        else:
            result = pull(client, state, project_id, claimed.get("paths"), bool(claimed.get("force"))).result()
    except SyncConflict as error:
        return _fail(client, claimed, str(error), empty_result(host_path, error.conflicts))
    except Exception as error:  # noqa: BLE001
        log.warning("sync request %s failed", claimed["id"], exc_info=not isinstance(error, SyncBackError))
        return _fail(client, claimed, str(error) or type(error).__name__, empty_result(host_path))
    done = client.complete_sync_request(claimed["id"], "applied", result=result)
    return Handled(done, True, describe_result(claimed["kind"], result), result)


def _fail(client: RequestClient, request: dict[str, Any], message: str, result: dict[str, Any]) -> Handled:
    done = client.complete_sync_request(request["id"], "failed", result=result, error=message)
    return Handled(done, False, message, result)
