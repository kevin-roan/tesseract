from typing import TYPE_CHECKING, ClassVar

from gi.repository import Adw

if TYPE_CHECKING:
    from ..context import AppContext


class PreferencesPage(Adw.PreferencesPage):
    id: ClassVar[str]
    order: ClassVar[int] = 100

    def __init__(self, ctx: "AppContext", dialog: Adw.PreferencesDialog, **kwargs) -> None:
        super().__init__(**kwargs)
        self.ctx = ctx
        self.dialog = dialog
        self.set_name(self.id)
