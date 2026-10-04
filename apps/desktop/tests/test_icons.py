import importlib.util
import re
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

from monolith_desktop.paths import ICONS_DIR
from monolith_desktop.theme.icons import ICONS, icon_candidates

DESKTOP_DIR = Path(__file__).resolve().parents[1]
ACTIONS_DIR = ICONS_DIR / "hicolor" / "scalable" / "actions"
BUNDLED_PREFIXES = ("ph-", "monolith-")
CUSTOM_DRAWN = frozenset({"window-minimize", "window-maximize", "window-restore", "window-close"})
SVG_NS = "{http://www.w3.org/2000/svg}"


def _generator():
    spec = importlib.util.spec_from_file_location("phosphor_icons", DESKTOP_DIR / "tools" / "phosphor_icons.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _bundled(name: str) -> Path:
    return ACTIONS_DIR / f"{name}.svg"


@pytest.mark.parametrize("key", sorted(set(ICONS) - CUSTOM_DRAWN))
def test_every_icon_leads_with_a_bundled_glyph(key):
    first = icon_candidates(key)[0]
    assert first.startswith(BUNDLED_PREFIXES), key
    assert _bundled(first).is_file(), first


def test_brand_mark_stays_custom():
    assert icon_candidates("brand")[0] == "monolith-brand-symbolic"


def test_every_key_keeps_a_theme_fallback():
    for key, candidates in ICONS.items():
        assert any(not name.startswith(BUNDLED_PREFIXES) for name in candidates), key


def test_generator_covers_every_mapped_phosphor_icon():
    gen = _generator()
    generated = {gen.icon_file(name)[: -len(".svg")] for name in gen.ICONS}
    mapped = {name for candidates in ICONS.values() for name in candidates if name.startswith("ph-")}
    assert mapped <= generated
    assert generated == {path.stem for path in ACTIONS_DIR.glob("ph-*.svg")}


def test_generator_kebab_names():
    gen = _generator()
    assert gen.icon_file("ArrowClockwise") == "ph-arrow-clockwise-symbolic.svg"
    assert gen.icon_file("QrCode") == "ph-qr-code-symbolic.svg"
    assert gen.icon_file("X") == "ph-x-symbolic.svg"


@pytest.mark.parametrize("path", sorted(ACTIONS_DIR.glob("ph-*.svg")), ids=lambda path: path.stem)
def test_phosphor_svgs_are_symbolic(path):
    root = ET.parse(path).getroot()
    assert root.tag == f"{SVG_NS}svg"
    assert root.get("viewBox") == "0 0 256 256"
    assert (root.get("width"), root.get("height")) == ("16", "16")
    paths = root.findall(f"{SVG_NS}path")
    assert paths and all(node.get("fill") == "#2e3436" and node.get("d") for node in paths)


def test_ui_code_uses_semantic_icon_keys():
    direct = re.compile(r"[\"'][a-z0-9-]+-symbolic[\"']")
    offenders = [
        str(path.relative_to(DESKTOP_DIR))
        for path in (DESKTOP_DIR / "monolith_desktop").rglob("*.py")
        if path.name != "icons.py" and direct.search(path.read_text(encoding="utf-8"))
    ]
    assert offenders == []
