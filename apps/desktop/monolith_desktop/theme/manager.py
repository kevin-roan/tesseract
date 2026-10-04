from collections.abc import Callable

import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")
gi.require_version("PangoCairo", "1.0")
from gi.repository import Adw, Gdk, Gtk, PangoCairo  # noqa: E402

from .chart import ChartPalette, chart_for  # noqa: E402
from .css import generate_css, scale_css  # noqa: E402
from .fonts import register_bundled_fonts  # noqa: E402
from .semantic import COLORS, RENDERED_SCHEME, SchemeName  # noqa: E402
from .surfaces import surfaces_for  # noqa: E402
from .tokens import ZOOM_STEPS  # noqa: E402
from .tone import TONE_COLORS, Tone  # noqa: E402


def rgba(value: str) -> Gdk.RGBA:
    color = Gdk.RGBA()
    color.parse(value)
    return color


class ThemeManager:
    def __init__(self) -> None:
        self._provider = Gtk.CssProvider()
        self._extra: list[tuple[Gtk.CssProvider, str]] = []
        self._zoom = 1.0
        self._listeners: list[Callable[[SchemeName], None]] = []
        self._style = Adw.StyleManager.get_default()
        register_bundled_fonts()
        self._fonts = {family.get_name() for family in PangoCairo.FontMap.get_default().list_families()}
        self._scheme: SchemeName = RENDERED_SCHEME

    def install(self, display: Gdk.Display | None = None) -> None:
        display = display or Gdk.Display.get_default()
        Gtk.StyleContext.add_provider_for_display(
            display, self._provider, Gtk.STYLE_PROVIDER_PRIORITY_USER + 1
        )
        self._style.set_color_scheme(Adw.ColorScheme.FORCE_DARK)
        self._reload()

    def add_stylesheet(self, css: str) -> None:
        provider = Gtk.CssProvider()
        provider.load_from_string(scale_css(css, self._zoom))
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(), provider, Gtk.STYLE_PROVIDER_PRIORITY_USER + 2
        )
        self._extra.append((provider, css))

    @property
    def zoom(self) -> float:
        return self._zoom

    def set_zoom(self, value: float) -> float:
        value = min(max(value, ZOOM_STEPS[0]), ZOOM_STEPS[-1])
        if value != self._zoom:
            self._zoom = value
            self._reload()
            for provider, css in self._extra:
                provider.load_from_string(scale_css(css, value))
        return self._zoom

    def step_zoom(self, direction: int) -> float:
        if direction == 0:
            return self.set_zoom(1.0)
        if direction > 0:
            return self.set_zoom(next((step for step in ZOOM_STEPS if step > self._zoom + 1e-6), ZOOM_STEPS[-1]))
        return self.set_zoom(next((step for step in reversed(ZOOM_STEPS) if step < self._zoom - 1e-6), ZOOM_STEPS[0]))

    @property
    def scheme(self) -> SchemeName:
        return self._scheme

    def css(self) -> str:
        return generate_css(self._scheme, self._fonts)

    def color(self, name: str, surface_tone: str | None = None) -> Gdk.RGBA:
        if surface_tone:
            ink = surfaces_for(self._scheme)[surface_tone].ink
            if name in ink:
                return rgba(ink[name])
        return rgba(COLORS[self._scheme][name])

    def hex(self, name: str) -> str:
        return COLORS[self._scheme][name]

    def tone_color(self, tone: Tone, role: str = "foreground") -> Gdk.RGBA:
        return self.color(getattr(TONE_COLORS[tone], role))

    def chart(self) -> ChartPalette:
        return chart_for(self._scheme)

    def subscribe(self, listener: Callable[[SchemeName], None]) -> Callable[[], None]:
        self._listeners.append(listener)
        return lambda: self._listeners.remove(listener) if listener in self._listeners else None

    def _reload(self) -> None:
        self._provider.load_from_string(scale_css(self.css(), self._zoom))


_manager: ThemeManager | None = None


def theme() -> ThemeManager:
    global _manager
    if _manager is None:
        _manager = ThemeManager()
    return _manager
