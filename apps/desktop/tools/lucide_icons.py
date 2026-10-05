#!/usr/bin/env python3
"""Writes the Lucide icons mapped in theme/icons.py as GTK symbolic SVGs.

The desktop follows Linear's look: thin, rounded stroke glyphs. Lucide is the open set closest to it.
GTK (4.20+) recolors strokes marked with the ``foreground-stroke`` class, so the outlines stay outlines.
Rerun after mapping a new ``lc-*`` name in theme/icons.py:

    python3 apps/desktop/tools/lucide_icons.py
"""

import re
import sys
import urllib.request
from pathlib import Path

DESKTOP_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DESKTOP_DIR))

from monolith_desktop.theme.icons import ICONS  # noqa: E402

VERSION = "1.52.0"
SOURCE = f"https://unpkg.com/lucide-static@{VERSION}/icons/{{name}}.svg"
OUT_DIR = DESKTOP_DIR / "data" / "icons" / "hicolor" / "scalable" / "actions"
PREFIX = "lc-"
SUFFIX = "-symbolic"
INK = "#2e3436"
STROKE_WIDTH = "2"

SHAPE = re.compile(r"<(path|polyline|polygon|line|circle|rect|ellipse)\b([^>]*?)/>", re.S)


def lucide_names() -> list[str]:
    names = {name for candidates in ICONS.values() for name in candidates if name.startswith(PREFIX)}
    return sorted(name[len(PREFIX):-len(SUFFIX)] for name in names)


def icon_file(lucide: str) -> str:
    return f"{PREFIX}{lucide}{SUFFIX}.svg"


def symbolic(source: str) -> str:
    shapes = []
    for tag, attrs in SHAPE.findall(source):
        filled = 'fill="currentColor"' in attrs
        attrs = re.sub(r'\s(fill|stroke|class)="[^"]*"', "", attrs).strip()
        role = "foreground-fill" if filled else "foreground-stroke transparent-fill"
        paint = f'fill="{INK}"' if filled else 'fill="none"'
        shapes.append(f'<{tag} class="{role}" {paint} {attrs}/>')
    if not shapes:
        raise ValueError("no drawable shapes")
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" '
        f'stroke="{INK}" stroke-width="{STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">'
        + "".join(shapes)
        + "</svg>\n"
    )


def fetch(lucide: str) -> str:
    with urllib.request.urlopen(SOURCE.format(name=lucide), timeout=30) as response:
        return response.read().decode("utf-8")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    names = lucide_names()
    for stale in OUT_DIR.glob(f"{PREFIX}*.svg"):
        if stale.name not in {icon_file(name) for name in names}:
            stale.unlink()
    for name in names:
        (OUT_DIR / icon_file(name)).write_text(symbolic(fetch(name)), encoding="utf-8")
    print(f"lucide_icons: wrote {len(names)} icons to {OUT_DIR}")


if __name__ == "__main__":
    main()
