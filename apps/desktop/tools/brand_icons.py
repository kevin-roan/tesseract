#!/usr/bin/env python3
"""Writes the framework logos mapped in theme/icons.py (FRAMEWORK_LOGOS) as single-color symbolic SVGs.

The glyphs come from Simple Icons (CC0). The files are ``-symbolic``, so GTK recolors them with the widget's text
color and they stay monochrome on both canvases. Rerun after adding a logo:

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


SYMBOLIC_FILL = "#2e3436"


def logo(source: str) -> str:
    match = PATH.search(source)
    if match is None:
        raise ValueError("no path")
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">'
        f'<path fill="{SYMBOLIC_FILL}" d="{match.group(1)}"/></svg>\n'
    )


def fetch(slug: str) -> str:
    with urllib.request.urlopen(SOURCE.format(name=slug), timeout=30) as response:
        return response.read().decode()


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    failed = []
    for slug in sorted({slug for slug in FRAMEWORK_LOGOS.values() if slug}):
        try:
            (OUT_DIR / f"{LOGO_PREFIX}{slug}-symbolic.svg").write_text(logo(fetch(slug)))
        except (OSError, ValueError) as error:
            failed.append(f"{slug}: {error}")
    for line in failed:
        print(f"brand_icons: {line}", file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
