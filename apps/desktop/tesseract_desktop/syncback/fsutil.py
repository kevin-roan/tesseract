import contextlib
import os
import shutil
import stat
import tempfile
from pathlib import Path

TMP_PREFIX = ".tesseract-sync-"


def fsync_dir(path: Path) -> None:
    try:
        fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    except OSError:
        return
    try:
        os.fsync(fd)
    except OSError:
        pass
    finally:
        os.close(fd)


def _temp_beside(target: Path) -> Path:
    fd, name = tempfile.mkstemp(prefix=TMP_PREFIX, dir=target.parent)
    os.close(fd)
    os.unlink(name)
    return Path(name)


def write_atomic(target: Path, data: bytes, mode: int = 0o644) -> None:
    fd, name = tempfile.mkstemp(prefix=TMP_PREFIX, dir=target.parent)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            os.fchmod(handle.fileno(), mode)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(name, target)
    except BaseException:
        with contextlib.suppress(FileNotFoundError):
            os.unlink(name)
        raise


def install(source: Path, target: Path, mode: int | None = None) -> None:
    """Put a copy of `source` (regular file or symlink) at `target` atomically: temp beside the target, then rename."""
    info = os.lstat(source)
    if stat.S_ISLNK(info.st_mode):
        temp = _temp_beside(target)
        os.symlink(os.readlink(source), temp)
    else:
        fd, name = tempfile.mkstemp(prefix=TMP_PREFIX, dir=target.parent)
        temp = Path(name)
        try:
            with os.fdopen(fd, "wb") as out, open(source, "rb") as src:
                shutil.copyfileobj(src, out)
                os.fchmod(out.fileno(), stat.S_IMODE(info.st_mode) if mode is None else mode)
                out.flush()
                os.fsync(out.fileno())
        except BaseException:
            with contextlib.suppress(FileNotFoundError):
                os.unlink(temp)
            raise
    try:
        os.replace(temp, target)
    except BaseException:
        with contextlib.suppress(FileNotFoundError):
            os.unlink(temp)
        raise


def copy_for_snapshot(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if source.is_symlink():
        os.symlink(os.readlink(source), target)
        return
    with open(source, "rb") as src, open(target, "wb") as out:
        shutil.copyfileobj(src, out)
        out.flush()
        os.fsync(out.fileno())
    shutil.copystat(source, target)


def file_mode(path: Path) -> int | None:
    try:
        info = os.lstat(path)
    except FileNotFoundError:
        return None
    return stat.S_IMODE(info.st_mode) if stat.S_ISREG(info.st_mode) else None


def is_executable(path: Path) -> bool:
    try:
        info = os.lstat(path)
    except FileNotFoundError:
        return False
    return stat.S_ISREG(info.st_mode) and bool(info.st_mode & 0o111)


def with_executable(mode: int, executable: bool) -> int:
    """`mode` with its executable bits set where it is readable (like git's 644/755), or cleared."""
    if not executable:
        return mode & ~0o111
    return mode if mode & 0o111 else mode | ((mode & 0o444) >> 2)


def exists(path: Path) -> bool:
    return os.path.lexists(path)


def remove(path: Path) -> None:
    with contextlib.suppress(FileNotFoundError):
        os.unlink(path)


def make_parents(root: Path, target: Path, created: list[Path]) -> None:
    missing = []
    parent = target.parent
    while parent != root and not exists(parent):
        missing.append(parent)
        parent = parent.parent
    for directory in reversed(missing):
        directory.mkdir()
        created.append(directory)


def prune_empty_parents(root: Path, target: Path) -> None:
    parent = target.parent
    while parent != root and root in parent.parents:
        try:
            parent.rmdir()
        except OSError:
            return
        parent = parent.parent

