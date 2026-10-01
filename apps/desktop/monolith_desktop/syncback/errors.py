class SyncBackError(Exception):
    pass


class NotLinked(SyncBackError):
    def __init__(self, project_id: str) -> None:
        super().__init__(f"{project_id} is not linked on this computer. Run monolith --sync in the checkout first")
        self.project_id = project_id


class SyncConflict(SyncBackError):
    def __init__(self, conflicts: list[str], action: str = "pull") -> None:
        what = "changed on the host since the last push" if action == "pull" else "changed on the host since that sync"
        super().__init__(f"{len(conflicts)} file{'s' if len(conflicts) != 1 else ''} {what}: {', '.join(conflicts[:5])}")
        self.conflicts = conflicts
