from pathlib import Path

import gi

gi.require_version("PangoCairo", "1.0")
from gi.repository import GLib, PangoCairo  # noqa: E402

from ..paths import FONTS_DIR  # noqa: E402


def bundled_fonts(directory: Path = FONTS_DIR) -> tuple[Path, ...]:
    return tuple(sorted(directory.glob("*.ttf"))) if directory.is_dir() else ()


def register_bundled_fonts(directory: Path = FONTS_DIR) -> int:
    font_map = PangoCairo.FontMap.get_default()
    if not hasattr(font_map, "add_font_file"):
        return 0
    added = 0
    for path in bundled_fonts(directory):
        try:
            added += bool(font_map.add_font_file(str(path)))
        except GLib.Error:
            continue
    return added
