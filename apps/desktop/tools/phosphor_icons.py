#!/usr/bin/env python3
"""Writes the Phosphor icons the desktop maps in theme/icons.py as GTK symbolic SVGs.

The mobile app draws its icons with phosphor-react-native; this copies the same "regular" weight glyphs
into data/icons so both apps share one icon set. Rerun after adding a name to ICONS below:

    python3 apps/desktop/tools/phosphor_icons.py
"""

import re
import sys
from pathlib import Path

ICONS = (
    "Archive",
    "ArrowClockwise",
    "ArrowCounterClockwise",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowSquareOut",
    "ArrowUp",
    "Broom",
    "Camera",
    "CaretDown",
    "CaretRight",
    "ChartBar",
    "ChatCircle",
    "CheckCircle",
    "Clipboard",
    "Clock",
    "ClockCounterClockwise",
    "CloudArrowDown",
    "CloudSlash",
    "Copy",
    "CornersIn",
    "CornersOut",
    "Cpu",
    "Cube",
    "Desktop",
    "DotsThree",
    "DownloadSimple",
    "Eye",
    "FileText",
    "Files",
    "FolderOpen",
    "FolderSimple",
    "FrameCorners",
    "GearSix",
    "GitBranch",
    "GitCommit",
    "Globe",
    "Hammer",
    "HardDrives",
    "House",
    "Info",
    "Keyboard",
    "List",
    "Lock",
    "MagnifyingGlass",
    "Memory",
    "Microphone",
    "Monitor",
    "Package",
    "Play",
    "PlugsConnected",
    "Plus",
    "QrCode",
    "Shuffle",
    "SidebarSimple",
    "Sparkle",
    "Stop",
    "Terminal",
    "TerminalWindow",
    "Tray",
    "Trash",
    "Warning",
    "WarningCircle",
    "Wrench",
    "X",
    "XCircle",
)

DESKTOP_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = DESKTOP_DIR.parents[1]
PACKAGE = Path("node_modules") / "phosphor-react-native" / "src" / "defs"
SEARCH = (REPO_DIR / PACKAGE, REPO_DIR / "apps" / "mobile" / PACKAGE)
OUT_DIR = DESKTOP_DIR / "data" / "icons" / "hicolor" / "scalable" / "actions"
FILL = "#2e3436"
WEIGHT = "regular"

WEIGHT_BLOCK = re.compile(r"\[\s*'(\w+)',\s*<>(.*?)</>,\s*\]", re.S)
ELEMENT = re.compile(r"<(\w+)\b([^>]*?)/>", re.S)
PATH_D = re.compile(r'\bd="([^"]+)"')


def kebab(name: str) -> str:
    return re.sub(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])", "-", name).lower()


def icon_file(name: str) -> str:
    return f"ph-{kebab(name)}-symbolic.svg"


def defs_dir() -> Path:
    for candidate in SEARCH:
        if candidate.is_dir():
            return candidate
    sys.exit(f"phosphor_icons: phosphor-react-native not installed (looked in {', '.join(map(str, SEARCH))}); run bun install")


def paths(source: str, name: str) -> list[str]:
    blocks = {weight: body for weight, body in WEIGHT_BLOCK.findall(source)}
    if WEIGHT not in blocks:
        raise ValueError(f"{name}: no '{WEIGHT}' weight")
    found = []
    for tag, attrs in ELEMENT.findall(blocks[WEIGHT]):
        match = PATH_D.search(attrs)
        if tag != "Path" or match is None:
            raise ValueError(f"{name}: unsupported <{tag}> in the '{WEIGHT}' weight")
        found.append(match.group(1))
    if not found:
        raise ValueError(f"{name}: empty '{WEIGHT}' weight")
    return found


def svg(ds: list[str]) -> str:
    body = "".join(f'<path fill="{FILL}" d="{d}"/>' for d in ds)
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256">{body}</svg>\n'


def main() -> None:
    source_dir = defs_dir()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name in ICONS:
        ds = paths((source_dir / f"{name}.tsx").read_text(encoding="utf-8"), name)
        (OUT_DIR / icon_file(name)).write_text(svg(ds), encoding="utf-8")
    print(f"phosphor_icons: wrote {len(ICONS)} icons to {OUT_DIR}")


if __name__ == "__main__":
    main()
