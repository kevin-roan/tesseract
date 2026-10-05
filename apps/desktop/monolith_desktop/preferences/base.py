from typing import TYPE_CHECKING, ClassVar

from gi.repository import Adw

from ..theme.icons import resolve_icon

if TYPE_CHECKING:
    from ..context import AppContext
    from .window import SettingsDialog


class PreferencesPage(Adw.PreferencesPage):
    id: ClassVar[str]
    order: ClassVar[int] = 100

    def __init__(self, ctx: "AppContext", dialog: "SettingsDialog", icon: str, **kwargs) -> None:
        super().__init__(icon_name=resolve_icon(icon), **kwargs)
        self.add_css_class("to-settings-page")
        self.icon_key = icon
        self.ctx = ctx
        self.dialog = dialog
        self.set_name(self.id)
