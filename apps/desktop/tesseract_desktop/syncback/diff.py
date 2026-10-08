import difflib
import io
import os
import stat
import tarfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from .manifest import resolve_inside

MAX_PREVIEW_BYTES = 1024 * 1024
MAX_DIFF_LINES = 4000
CONTEXT_LINES = 3

DiffState = Literal["text", "binary", "too_large", "identical", "empty"]
LineKind = Literal["hunk", "add", "del", "ctx", "note"]


@dataclass(frozen=True)
class DiffLine:
    kind: LineKind
    text: str
    old: int | None = None
    new: int | None = None


@dataclass(frozen=True)
class FileDiff:
    """What syncing one file changes on the host: `before` is the host copy, `after` the sandbox one."""

    state: DiffState
    lines: list[DiffLine] = field(default_factory=list)
    added: int = 0
    removed: int = 0
    truncated: bool = False
    before_size: int | None = None
    after_size: int | None = None


class TooLarge(Exception):
    def __init__(self, size: int) -> None:
        super().__init__(f"{size} bytes")
        self.size = size


def read_host_file(root: Path, rel: str, limit: int = MAX_PREVIEW_BYTES) -> bytes | None:
    """The host copy of `rel` (a symlink's target as bytes), None when absent; raises `TooLarge` past `limit`."""
    path = resolve_inside(root, rel)
    try:
        info = os.lstat(path)
    except FileNotFoundError:
        return None
    if stat.S_ISLNK(info.st_mode):
        return os.fsencode(os.readlink(path))
    if not stat.S_ISREG(info.st_mode):
        return None
    if info.st_size > limit:
        raise TooLarge(info.st_size)
    return path.read_bytes()


def extract_member(archive: bytes, rel: str, limit: int = MAX_PREVIEW_BYTES) -> bytes | None:
    """`rel` out of a `sync_export` gzip tar (a symlink's target as bytes); raises `TooLarge` past `limit`."""
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as tar:
        for member in tar:
            if member.name.removeprefix("./") != rel:
                continue
            if member.issym():
                return os.fsencode(member.linkname)
            if not member.isfile():
                return None
            if member.size > limit:
                raise TooLarge(member.size)
            handle = tar.extractfile(member)
            return handle.read() if handle else None
    return None


def _decode(data: bytes) -> list[str] | None:
    if b"\0" in data[:8192]:
        return None
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return None
    return text.splitlines(keepends=True)


def _strip(line: str) -> str:
    return line.rstrip("\r\n")


def diff_file(before: bytes | None, after: bytes | None, max_lines: int = MAX_DIFF_LINES) -> FileDiff:
    """A unified diff of the host copy (`before`, None: absent) against the sandbox copy (`after`, None: deleted)."""
    sizes = {"before_size": None if before is None else len(before), "after_size": None if after is None else len(after)}
    if before == after:
        return FileDiff("identical" if before else "empty", **sizes)
    old, new = _decode(before or b""), _decode(after or b"")
    if old is None or new is None:
        return FileDiff("binary", **sizes)
    lines: list[DiffLine] = []
    added = removed = 0
    truncated = False
    for group in difflib.SequenceMatcher(None, old, new, autojunk=False).get_grouped_opcodes(CONTEXT_LINES):
        first, last = group[0], group[-1]
        lines.append(DiffLine("hunk", f"@@ -{first[1] + 1},{last[2] - first[1]} +{first[3] + 1},{last[4] - first[3]} @@"))
        for tag, i1, i2, j1, j2 in group:
            if tag == "equal":
                lines.extend(DiffLine("ctx", _strip(old[i]), i + 1, j1 + i - i1 + 1) for i in range(i1, i2))
                continue
            if tag in ("replace", "delete"):
                lines.extend(DiffLine("del", _strip(old[i]), i + 1, None) for i in range(i1, i2))
                removed += i2 - i1
            if tag in ("replace", "insert"):
                lines.extend(DiffLine("add", _strip(new[j]), None, j + 1) for j in range(j1, j2))
                added += j2 - j1
        if len(lines) > max_lines:
            truncated = True
            break
    if not lines:
        return FileDiff("empty", **sizes)
    return FileDiff("text", lines[:max_lines], added, removed, truncated, **sizes)
