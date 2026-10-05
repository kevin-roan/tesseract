import importlib.util
import re
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

from monolith_desktop.paths import ICONS_DIR
from monolith_desktop.theme.icons import ICONS, icon_candidates

DESKTOP_DIR = Path(__file__).resolve().parents[1]
ACTIONS_DIR = ICONS_DIR / "hicolor" / "scalable" / "actions"
BUNDLED_PREFIXES = ("lc-", "monolith-")
CUSTOM_DRAWN = frozenset({"window-minimize", "window-maximize", "window-restore", "window-close"})
SVG_NS = "{http://www.w3.org/2000/svg}"


def _generator():
    spec = importlib.util.spec_from_file_location("lucide_icons", DESKTOP_DIR / "tools" / "lucide_icons.py")
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


def test_generator_covers_every_mapped_lucide_icon():
    gen = _generator()
    generated = {gen.icon_file(name)[: -len(".svg")] for name in gen.lucide_names()}
    mapped = {name for candidates in ICONS.values() for name in candidates if name.startswith("lc-")}
    assert mapped == generated
    assert generated == {path.stem for path in ACTIONS_DIR.glob("lc-*.svg")}


def test_generator_file_names():
    gen = _generator()
    assert gen.icon_file("refresh-cw") == "lc-refresh-cw-symbolic.svg"
    assert gen.icon_file("x") == "lc-x-symbolic.svg"


def test_generator_marks_strokes_symbolic():
    gen = _generator()
    out = gen.symbolic('<svg><path d="M1 1h2"/><circle cx="1" cy="1" r="1" fill="currentColor"/></svg>')
    assert '<path class="foreground-stroke transparent-fill" fill="none" d="M1 1h2"/>' in out
    assert 'class="foreground-fill" fill="#2e3436"' in out


@pytest.mark.parametrize("path", sorted(ACTIONS_DIR.glob("lc-*.svg")), ids=lambda path: path.stem)
def test_lucide_svgs_are_symbolic(path):
    root = ET.parse(path).getroot()
    assert root.tag == f"{SVG_NS}svg"
    assert root.get("viewBox") == "0 0 24 24"
    assert (root.get("width"), root.get("height")) == ("16", "16")
    shapes = list(root)
    assert shapes and all("foreground-" in (node.get("class") or "") for node in shapes)


def test_ui_code_uses_semantic_icon_keys():
    direct = re.compile(r"[\"'][a-z0-9-]+-symbolic[\"']")
    offenders = [
        str(path.relative_to(DESKTOP_DIR))
        for path in (DESKTOP_DIR / "monolith_desktop").rglob("*.py")
        if path.name != "icons.py" and direct.search(path.read_text(encoding="utf-8"))
    ]
    assert offenders == []
