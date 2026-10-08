import os
import posixpath
import stat
import subprocess
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from pathlib import Path

from .errors import SyncBackError
from .fsutil import is_executable
from .manifest import GIT_DIR, Manifest, build_manifest, check_relative

LOCK_SUFFIX = ".lock"

GitManifest = dict[str, str]


@dataclass(frozen=True)
class HostTree:
    manifest: Manifest
    executable: list[str]
    git: GitManifest | None


def _git(root: Path, *args: str) -> str | None:
    try:
        result = subprocess.run(["git", "-C", str(root), *args], capture_output=True, check=True)
    except (OSError, subprocess.CalledProcessError):
        return None
    return result.stdout.decode("utf-8", "surrogateescape")


def collect_files(root: Path) -> Iterator[str]:
    """Paths relative to `root`: tracked and unignored files of a git checkout (plus `.git` at its top), else everything."""
    listed = _git(root, "ls-files", "-z", "--cached", "--others", "--exclude-standard")
    if listed is None:
        for dirpath, dirnames, filenames in os.walk(root):
            base = Path(dirpath).relative_to(root)
            for name in filenames + [d for d in dirnames if (Path(dirpath) / d).is_symlink()]:
                yield str(base / name)
        return
    if (root / GIT_DIR).exists():
        yield GIT_DIR
    for path in dict.fromkeys(filter(None, listed.split("\0"))):
        if os.path.lexists(root / path):
            yield path


def contained(root: Path, files: Iterable[str]) -> list[str]:
    """The plain relative paths of `files` whose parent directory resolves inside `root` (no symlinked escapes)."""
    root = root.resolve()
    parents: dict[str, bool] = {}
    kept = []
    for rel in files:
        rel = Path(rel).as_posix()
        try:
            check_relative(rel)
        except SyncBackError:
            continue
        parent = posixpath.dirname(rel)
        if parent not in parents:
            resolved = (root / parent).resolve()
            parents[parent] = resolved == root or root in resolved.parents
        if parents[parent]:
            kept.append(rel)
    return kept


def git_manifest(root: Path) -> GitManifest | None:
    """`{path under .git: "<size>:<mtime_ns>"}` for the regular files of a real `.git` directory (no `*.lock`), else None."""
    top = root / GIT_DIR
    try:
        if not stat.S_ISDIR(os.lstat(top).st_mode):
            return None
    except FileNotFoundError:
        return None
    found: GitManifest = {}
    for dirpath, _dirnames, filenames in os.walk(top):
        base = Path(dirpath).relative_to(top)
        for name in filenames:
            if name.endswith(LOCK_SUFFIX):
                continue
            try:
                info = os.lstat(Path(dirpath) / name)
            except FileNotFoundError:
                continue
            if stat.S_ISREG(info.st_mode):
                found[(base / name).as_posix()] = f"{info.st_size}:{info.st_mtime_ns}"
    return found


def scan_tree(root: Path, files: Iterable[str]) -> HostTree:
    manifest = build_manifest(root, contained(root, files))
    return HostTree(manifest, sorted(path for path in manifest if is_executable(root / path)), git_manifest(root))
