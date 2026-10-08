import importlib
import logging
import pkgutil

from ..strings import SECTION_ORDER
from .base import Page

log = logging.getLogger(__name__)

SKIP_MODULES = {"base"}


def discover_pages() -> list[type[Page]]:
    pages: dict[str, type[Page]] = {}
    for module_info in pkgutil.iter_modules(__path__):
        name = module_info.name
        if name.startswith("_") or name in SKIP_MODULES:
            continue
        try:
            module = importlib.import_module(f"{__name__}.{name}")
        except Exception:
            log.exception("failed to load page module %s", name)
            continue
        page = getattr(module, "PAGE", None)
        if isinstance(page, type) and issubclass(page, Page):
            if page.id in pages:
                log.warning("duplicate page id %s in %s", page.id, name)
                continue
            pages[page.id] = page

    def sort_key(page: type[Page]) -> tuple[int, int, str]:
        section = SECTION_ORDER.index(page.section) if page.section in SECTION_ORDER else len(SECTION_ORDER)
        return section, page.order, page.title

    return sorted(pages.values(), key=sort_key)


__all__ = ["Page", "discover_pages"]
