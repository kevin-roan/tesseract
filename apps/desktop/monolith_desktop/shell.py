from gi.repository import Adw, Gio, Gtk

from .context import AppContext
from .services.connection_view import (
    banner_for,
    connection_label,
    connection_tone,
    events_label,
    events_tone,
    status_title,
)
from .store import ConnectionState
from .strings import MENU, STATUS_FOOTER
from .widgets.badges import ConnectionDot
from .widgets.icon import Icon
from .widgets.text import Text
from .widgets.titlebar import HeaderTitle, Titlebar


class ConnectionBannerController:
    def __init__(self, ctx: AppContext, banner: Adw.Banner) -> None:
        self._ctx = ctx
        self._banner = banner
        self._action: str | None = None
        self._tone: str | None = None
        banner.connect("button-clicked", lambda *_: self._activate())
        ctx.store.connection.bind(banner, self._render)

    def _render(self, state: ConnectionState) -> None:
        model = banner_for(state)
        self._banner.set_title(model.title)
        self._banner.set_button_label(model.button_label)
        self._action = model.action
        tone = connection_tone(state)
        if tone != self._tone:
            if self._tone:
                self._banner.remove_css_class(f"tone-{self._tone}")
            self._banner.add_css_class(f"tone-{tone}")
            self._tone = tone
        self._banner.set_revealed(model.visible)

    def _activate(self) -> None:
        if self._action == "retry":
            self._ctx.connection.refresh()
        elif self._action == "preferences":
            self._ctx.open_preferences()


def connection_banner(ctx: AppContext) -> Adw.Banner:
    banner = Adw.Banner(revealed=False, css_classes=["to-banner"])
    banner._controller = ConnectionBannerController(ctx, banner)
    return banner


class ConnectionStatusRow(Gtk.Button):
    def __init__(self, ctx: AppContext) -> None:
        super().__init__(css_classes=["to-sidebar-status"], tooltip_text=STATUS_FOOTER["tooltip"])
        self._ctx = ctx
        self._connection = ConnectionDot()
        self._title = Text("", "label", "textSecondary")
        self._detail = Text("", "caption", "textTertiary")
        self._detail.set_hexpand(True)
        box = Gtk.Box(spacing=8)
        for widget in (self._connection, self._title, self._detail, Icon("settings", "sm", "textTertiary")):
            box.append(widget)
        self.set_child(box)
        self.connect("clicked", lambda *_: ctx.open_preferences())
        ctx.store.connection.bind(self, lambda _state: self._render())
        ctx.store.events.bind(self, lambda _status: self._render())

    def _render(self) -> None:
        state = self._ctx.store.connection.value
        events = self._ctx.store.events.value
        self._connection.set_tone(connection_tone(state) if not state.online else events_tone(events))
        self._title.set_label(status_title(state))
        detail = [connection_label(state, with_name=False)]
        if state.online:
            detail.append(events_label(events))
        self._detail.set_label(STATUS_FOOTER["separator"].join(detail))
        self.set_tooltip_text(state.error_message or STATUS_FOOTER["tooltip"])


def main_menu() -> Gio.Menu:
    menu = Gio.Menu()
    top = Gio.Menu()
    top.append(MENU["new_conversation"], "app.new-conversation")
    top.append(MENU["preferences"], "app.preferences")
    top.append(MENU["pair"], "app.pair")
    top.append(MENU["pair_host"], "app.pair-host")
    top.append(MENU["rediscover"], "app.rediscover")
    menu.append_section(None, top)
    bottom = Gio.Menu()
    bottom.append(MENU["about"], "app.about")
    bottom.append(MENU["quit"], "app.quit")
    menu.append_section(None, bottom)
    return menu


def toolbar_page(
    ctx: AppContext,
    title: str,
    content: Gtk.Widget,
    header_widgets: list[Gtk.Widget] | None = None,
    tag: str | None = None,
    start_widgets: list[Gtk.Widget] | None = None,
    subtitle: str | None = None,
) -> Adw.NavigationPage:
    heading = HeaderTitle(title, subtitle)
    header = Titlebar(start=[*(start_widgets or []), heading], end=header_widgets)
    view = Adw.ToolbarView(content=content, css_classes=["to-content-view"])
    view.add_top_bar(header)
    view.add_top_bar(connection_banner(ctx))
    page = Adw.NavigationPage(title=title, child=view)
    if tag:
        page.set_tag(tag)
    return page
