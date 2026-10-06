#!/usr/bin/env python3
"""Writes the framework logos mapped in theme/icons.py (FRAMEWORK_LOGOS) as full-color SVGs.

The glyphs come from Simple Icons (CC0). Each is painted in a brand color that reads on both the dark and the
light canvas, so the files are not ``-symbolic`` and GTK draws them as they are. Rerun after adding a logo:

    python3 apps/desktop/tools/brand_icons.py
"""

import re
import sys
import urllib.request
from pathlib import Path

DESKTOP_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DESKTOP_DIR))

from monolith_desktop.theme.icons import FRAMEWORK_LOGOS, LOGO_PREFIX  # noqa: E402

VERSION = "13.21.0"
SOURCE = f"https://unpkg.com/simple-icons@{VERSION}/icons/{{name}}.svg"
OUT_DIR = DESKTOP_DIR / "data" / "icons" / "hicolor" / "scalable" / "actions"
PATH = re.compile(r'<path d="([^"]+)"')


def logo(source: str, color: str) -> str:
    match = PATH.search(source)
    if match is None:
        raise ValueError("no path")
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">'
        f'<path fill="{color}" d="{match.group(1)}"/></svg>\n'
    )


def fetch(slug: str) -> str:
    with urllib.request.urlopen(SOURCE.format(name=slug), timeout=30) as response:
        return response.read().decode()


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    failed = []
    for slug, color in sorted({(slug, color) for slug, color in FRAMEWORK_LOGOS.values() if slug}):
        try:
            (OUT_DIR / f"{LOGO_PREFIX}{slug}.svg").write_text(logo(fetch(slug), color))
        except (OSError, ValueError) as error:
            failed.append(f"{slug}: {error}")
    for line in failed:
        print(f"brand_icons: {line}", file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
