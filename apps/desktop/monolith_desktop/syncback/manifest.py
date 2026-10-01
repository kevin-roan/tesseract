import hashlib
import os
import posixpath
import stat
from collections.abc import Iterable
from pathlib import Path

from .errors import SyncBackError

GIT_DIR = ".git"
SKIPPED_DIRS = (GIT_DIR, "node_modules")
CHUNK = 1024 * 1024

Manifest = dict[str, str]


def hash_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def hash_path(path: Path) -> str | None:
    """sha256 of a regular file's content or a symlink's target; None when absent (or not a file/symlink)."""
    try:
        info = os.lstat(path)
    except FileNotFoundError:
        return None
    if stat.S_ISLNK(info.st_mode):
        return hash_bytes(os.fsencode(os.readlink(path)))
    if not stat.S_ISREG(info.st_mode):
        return None
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        while chunk := handle.read(CHUNK):
            digest.update(chunk)
    return digest.hexdigest()


def is_git_path(rel: str) -> bool:
    return GIT_DIR in rel.split("/")


def build_manifest(root: Path, files: Iterable[str]) -> Manifest:
    manifest: Manifest = {}
    for rel in files:
        rel = Path(rel).as_posix()
        if is_git_path(rel) or rel.split("/")[0] in SKIPPED_DIRS:
            continue
        digest = hash_path(root / rel)
        if digest is not None:
            manifest[rel] = digest
    return manifest


def check_relative(rel: str) -> str:
    if not isinstance(rel, str) or not rel or "\0" in rel or "\\" in rel:
        raise SyncBackError(f"Refusing unsafe path {rel!r}")
    if rel.startswith("/") or posixpath.isabs(rel):
        raise SyncBackError(f"Refusing absolute path {rel!r}")
    parts = rel.split("/")
    if any(part in ("", ".", "..") for part in parts):
        raise SyncBackError(f"Refusing path {rel!r}: it must be a plain relative path")
    if GIT_DIR in parts:
        raise SyncBackError(f"Refusing to write inside .git: {rel!r}")
    return rel


def resolve_inside(root: Path, rel: str) -> Path:
    """Validate `rel` and return root/rel; its parent directory must resolve inside root (no symlinked escapes)."""
    check_relative(rel)
    root = root.resolve()
    target = root / rel
    parent = target.parent.resolve()
    if parent != root and root not in parent.parents:
        raise SyncBackError(f"Refusing path {rel!r}: it leaves {root}")
    return target
