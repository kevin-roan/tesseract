"""Per-area CSS rules.

Every module in this package may define ``rules(scheme) -> dict[selector, dict[prop, value]]``.
They are appended after the core component rules, in module-name order, so each
feature area owns its own file instead of growing ``css.py``.
"""

import importlib
import logging
import pkgutil
from collections.abc import Callable

from ..semantic import SchemeName

log = logging.getLogger(__name__)

RuleSet = dict[str, dict[str, str]]


def _providers() -> list[Callable[[SchemeName], RuleSet]]:
    providers = []
    for module_info in sorted(pkgutil.iter_modules(__path__), key=lambda info: info.name):
        if module_info.name.startswith("_"):
            continue
        try:
            module = importlib.import_module(f"{__name__}.{module_info.name}")
        except Exception:
            log.exception("failed to load css module %s", module_info.name)
            continue
        rules = getattr(module, "rules", None)
        if callable(rules):
            providers.append(rules)
    return providers


def extra_rules(scheme: SchemeName) -> RuleSet:
    merged: RuleSet = {}
    for provider in _providers():
        for selector, props in provider(scheme).items():
            merged.setdefault(selector, {}).update(props)
    return merged
