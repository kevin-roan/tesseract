from dataclasses import dataclass

from gi.repository import Adw

from ..strings import APPEARANCE as S
from ..theme.semantic import APPEARANCES, Appearance
from ..widgets import RadioRows
from .base import PreferencesPage


@dataclass(frozen=True)
class AppearanceChoice:
    id: Appearance
    title: str
    subtitle: str
    available: bool = True


class AppearancePreferences(PreferencesPage):
    id = "appearance"
    order = 5

    def __init__(self, ctx, dialog) -> None:
        super().__init__(ctx, dialog, title=S["title"], icon=S["icon"])
        group = Adw.PreferencesGroup(title=S["theme_group"], description=S["theme_description"])
        self._rows = RadioRows(group, self._on_selected)
        self._rows.set_choices(
            [AppearanceChoice(choice, S[choice], S[f"{choice}_subtitle"]) for choice in APPEARANCES],
            ctx.theme.appearance,
        )
        self.add(group)

    def _on_selected(self, choice: str) -> None:
        if choice in APPEARANCES:
            self.ctx.app.set_appearance(choice)


PREFERENCES_PAGE = AppearancePreferences
