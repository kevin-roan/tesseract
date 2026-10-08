import importlib
import logging
import pkgutil
from typing import TYPE_CHECKING

from .base import PreferencesPage
from .window import SettingsDialog

if TYPE_CHECKING:
    from ..context import AppContext

log = logging.getLogger(__name__)

SKIP_MODULES = {"base", "window"}


def discover_preference_pages() -> list[type[PreferencesPage]]:
    found: list[type[PreferencesPage]] = []
    for module_info in pkgutil.iter_modules(__path__):
        if module_info.name.startswith("_") or module_info.name in SKIP_MODULES:
            continue
        try:
            module = importlib.import_module(f"{__name__}.{module_info.name}")
        except Exception:
            log.exception("failed to load preferences module %s", module_info.name)
            continue
        page = getattr(module, "PREFERENCES_PAGE", None)
        if isinstance(page, type) and issubclass(page, PreferencesPage):
            found.append(page)
    return sorted(found, key=lambda page: (page.order, page.id))


def open_preferences(ctx: "AppContext", page_id: str | None = None) -> SettingsDialog:
    dialog = SettingsDialog()
    for page_cls in discover_preference_pages():
        dialog.add(page_cls(ctx, dialog))
    if page_id:
        dialog.set_visible_page_name(page_id)
    dialog.present(ctx.window)
    return dialog


__all__ = ["PreferencesPage", "discover_preference_pages", "open_preferences"]
