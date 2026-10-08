from .pull import PullOutcome
from .revert import RevertOutcome

UNDO_HINT = "undo with tesseract --revert"


def plural(count: int, word: str) -> str:
    return f"{count} {word}{'' if count == 1 else 's'}"


def breakdown(*counts: tuple[int, str]) -> str:
    return ", ".join(f"{n} {label}" for n, label in counts if n)


def describe_pull(outcome: PullOutcome) -> str:
    counts = breakdown((len(outcome.added), "added"), (len(outcome.modified), "modified"), (len(outcome.deleted), "deleted"))
    if outcome.total == 0:
        return f"Nothing to sync: {outcome.host_path} already matches the sandbox"
    if outcome.dry_run:
        return f"Would pull {plural(outcome.total, 'file')} into {outcome.host_path} ({counts})"
    return f"Pulled {plural(outcome.total, 'file')} into {outcome.host_path} ({counts}) · snapshot {outcome.snapshot_id} — {UNDO_HINT}"


def describe_revert(outcome: RevertOutcome) -> str:
    counts = breakdown((len(outcome.restored), "restored"), (len(outcome.recreated), "recreated"), (len(outcome.removed), "removed"))
    return f"Reverted snapshot {outcome.snapshot_id} in {outcome.host_path} ({counts or 'no files'})"


def describe_get(result: dict) -> str:
    added, modified, deleted = result.get("added", 0), result.get("modified", 0), result.get("deleted", 0)
    total = added + modified + deleted
    counts = breakdown((added, "added"), (modified, "modified"), (deleted, "deleted"))
    parts = [f"Sent {plural(total, 'file')} to the sandbox ({counts})" if total else "Sandbox already up to date"]
    if total and "insertions" in result:
        parts.append(f"+{result['insertions']} −{result.get('deletions', 0)}")
    if result.get("gitFiles"):
        parts.append(f"updated .git ({plural(result['gitFiles'], 'file')})")
    if result.get("backupPath"):
        parts.append(f"sandbox edits kept in {result['backupPath']}")
    return " · ".join(parts)


def describe_result(kind: str, result: dict) -> str:
    if kind == "get":
        return describe_get(result)
    added, modified, deleted = result.get("added", 0), result.get("modified", 0), result.get("deleted", 0)
    where = result.get("hostPath") or ""
    if kind == "revert":
        counts = breakdown((modified, "restored"), (added, "recreated"), (deleted, "removed"))
        return f"Reverted the last sync in {where} ({counts or 'no files'})"
    counts = breakdown((added, "added"), (modified, "modified"), (deleted, "deleted"))
    return f"Pulled {plural(added + modified + deleted, 'file')} into {where} ({counts or 'no changes'})"
