import logging
import os
import shutil
from collections.abc import Iterable, Mapping
from pathlib import Path

from .config.storage import config_dir
from .syncback.state import state_dir

log = logging.getLogger(__name__)

LEGACY_CONFIG_DIR_NAMES = ("monolith-desktop", "theone-desktop")
LEGACY_STATE_DIR_NAMES = ("monolith",)


def copy_legacy_dir(target: Path, legacy_names: Iterable[str]) -> Path | None:
    if target.exists():
        return None
    for name in legacy_names:
        legacy = target.with_name(name)
        if not legacy.is_dir():
            continue
        try:
            shutil.copytree(legacy, target, symlinks=True)
        except OSError:
            log.warning("could not copy %s to %s", legacy, target, exc_info=True)
            shutil.rmtree(target, ignore_errors=True)
            return None
        return legacy
    return None


def migrate_legacy_dirs(env: Mapping[str, str] = os.environ) -> None:
    copy_legacy_dir(config_dir(env), LEGACY_CONFIG_DIR_NAMES)
    copy_legacy_dir(state_dir(env), LEGACY_STATE_DIR_NAMES)
