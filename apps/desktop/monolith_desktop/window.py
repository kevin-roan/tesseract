import logging
from collections.abc import Callable
from typing import Any

from gi.repository import Adw, Gtk

from . import APP_NAME
from .context import AppContext
from .pages import Page, discover_pages
from .shell import ConnectionStatusRow, menu_button, toolbar_page
from .strings import SECTION_TITLES, SIDEBAR
from .theme.tokens import (
    COLLAPSE_BREAKPOINT,
    DEFAULT_WINDOW_SIZE,
    MIN_WINDOW_SIZE,
    SIDEBAR_WIDTH_FRACTION,
    SIDEBAR_WIDTH_RANGE,
)
from .widgets.badges import CountBadge
from .widgets.icon import Icon
from .widgets.sidebar_composer import SidebarComposer
from .widgets.sidebar_projects import SidebarProjects
from .widgets.text import Text
from .widgets.titlebar import BrandMark, Titlebar

log = logging.getLogger(__name__)

BRAND_ICON = "brand"


class SidebarRow(Gtk.ListBoxRow):
    def __init__(self, page_cls: type[Page], ctx: AppContext) -> None:
        super().__init__(css_classes=["to-nav-row"])
        self.page_cls = page_cls
        box = Gtk.Box(spacing=12)
        box.append(Icon(page_cls.icon, "sm"))
        label = Text(page_cls.title, "label")
        label.set_hexpand(True)
        box.append(label)
        self.badge = CountBadge()
        box.append(self.badge)
        self.set_child(box)
        observable = page_cls.badge(ctx)
        if observable is not None:
            observable.bind(self, self.badge.set_count)


class NewConversationButton(Gtk.Button):
    def __init__(self, on_activate) -> None:
        super().__init__(css_classes=["to-new-conversation"])
        box = Gtk.Box(spacing=10)
        box.append(Icon("compose", "sm"))
        label = Text(SIDEBAR["new_conversation"], "label")
        label.remove_css_class("to-fg-text")
        label.set_hexpand(True)
        box.append(label)
        hint = Text(SIDEBAR["new_conversation_shortcut"], "caption")
        hint.remove_css_class("to-fg-text")
        hint.add_css_class("to-shortcut-hint")
        box.append(hint)
        self.set_child(box)
        self.connect("clicked", lambda *_: on_activate())


class MainWindow(Adw.ApplicationWindow):
    def __init__(self, app: Adw.Application, ctx: AppContext) -> None:
        super().__init__(application=app, title=APP_NAME)
        self.add_css_class("to-main-window")
        self.set_default_size(*DEFAULT_WINDOW_SIZE)
        self.set_size_request(*MIN_WINDOW_SIZE)
        self.set_icon_name(app.get_application_id())
        self.ctx = ctx
        ctx.window = self
        self._pages: dict[str, Page] = {}
        self._roots: dict[str, Adw.NavigationPage] = {}
        self._rows: dict[str, SidebarRow] = {}
        self._current: str | None = None
        self._page_classes = discover_pages()

        self._toasts = Adw.ToastOverlay()
        self._split = Adw.NavigationSplitView(
            min_sidebar_width=SIDEBAR_WIDTH_RANGE[0],
            max_sidebar_width=SIDEBAR_WIDTH_RANGE[1],
            sidebar_width_fraction=SIDEBAR_WIDTH_FRACTION,
        )
        self._toasts.set_child(self._split)
        self.set_content(self._toasts)

        self._split.set_sidebar(self._build_sidebar())
        self._nav = Adw.NavigationView()
        self._content = Adw.NavigationPage(title=APP_NAME, child=self._nav, css_classes=["to-canvas"])
        self._split.set_content(self._content)

        breakpoint = Adw.Breakpoint.new(Adw.BreakpointCondition.parse(COLLAPSE_BREAKPOINT))
        breakpoint.add_setter(self._split, "collapsed", True)
        self.add_breakpoint(breakpoint)
        self._split.connect("notify::collapsed", lambda *_: self._sync_collapsed())
        self._sync_collapsed()

        self.connect("close-request", self._on_close_request)
        self.connect("notify::visible", lambda *_: ctx.store.window_visible.set(self.get_visible()))

        if self._page_classes:
            self.navigate(self._page_classes[0].id)

    def _build_sidebar(self) -> Adw.NavigationPage:
        self._list = Gtk.ListBox(css_classes=["to-nav-list"], selection_mode=Gtk.SelectionMode.SINGLE)
        self._list.set_header_func(self._header_func)
        for page_cls in self._page_classes:
            row = SidebarRow(page_cls, self.ctx)
            self._rows[page_cls.id] = row
            self._list.append(row)
        self._list.connect("row-activated", lambda _list, row: self.navigate(row.page_cls.id))

        self._composer = SidebarComposer(self.ctx)
        projects = SidebarProjects(self.ctx, self._composer.select_project)
        body = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, css_classes=["to-sidebar-body"])
        body.append(NewConversationButton(self.new_conversation))
        body.append(self._list)
        body.append(projects)
        scroller = Gtk.ScrolledWindow(child=body, vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER)

        self._sidebar_header = Titlebar(start=[BrandMark(APP_NAME, BRAND_ICON)], end=[menu_button()])
        footer = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, css_classes=["to-sidebar-bottom"])
        footer.append(self._composer)
        footer.append(ConnectionStatusRow(self.ctx))

        view = Adw.ToolbarView(content=scroller, css_classes=["to-sidebar"])
        view.add_top_bar(self._sidebar_header)
        view.add_bottom_bar(footer)
        return Adw.NavigationPage(title=APP_NAME, child=view)

    def _header_func(self, row: SidebarRow, before: SidebarRow | None) -> None:
        section = row.page_cls.section
        if before is not None and before.page_cls.section == section:
            row.set_header(None)
            return
        label = Text(SECTION_TITLES.get(section, section.title()), "overline", "textTertiary")
        label.add_css_class("to-side-section")
        row.set_header(label)

    def _sync_collapsed(self) -> None:
        self._sidebar_header.set_controls_visible(self._split.get_collapsed())

    def page(self, page_id: str) -> Page | None:
        if page_id in self._pages:
            return self._pages[page_id]
        page_cls = next((cls for cls in self._page_classes if cls.id == page_id), None)
        if page_cls is None:
            return None
        try:
            page = page_cls(self.ctx)
            widget = page.build()
        except Exception:
            log.exception("failed to build page %s", page_id)
            return None
        self._pages[page_id] = page
        self._roots[page_id] = toolbar_page(self.ctx, page_cls.title, widget, page.header_widgets(), tag=page_id)
        return page

    def navigate(self, page_id: str, params: dict[str, Any] | None = None) -> bool:
        page = self.page(page_id)
        if page is None:
            log.warning("unknown page %s", page_id)
            return False
        if self._current != page_id:
            previous = self._pages.get(self._current) if self._current else None
            if previous:
                previous.on_hidden()
            self._current = page_id
            root = self._roots[page_id]
            self._nav.replace([root])
            self._content.set_title(root.get_title())
            self.ctx.store.current_page.set(page_id)
            row = self._rows.get(page_id)
            if row is not None and self._list.get_selected_row() is not row:
                self._list.select_row(row)
            page.on_shown()
        else:
            self._nav.pop_to_tag(page_id)
        self._split.set_show_content(True)
        if params:
            page.open(params)
        return True

    def new_conversation(self) -> bool:
        return self.navigate("agents", {"new": True})

    def focus_composer(self) -> None:
        self.show_sidebar()
        self._composer.focus()

    def show_sidebar(self) -> None:
        self._split.set_show_content(False)

    @property
    def current_page_id(self) -> str | None:
        return self._current

    def push(self, title: str, widget: Gtk.Widget, header_widgets: list[Gtk.Widget] | None = None, tag: str | None = None):
        parent = self._roots.get(self._current) if self._current else None
        subtitle = parent.get_title() if parent is not None else ""
        page = toolbar_page(self.ctx, title, widget, header_widgets, tag, subtitle=subtitle)
        self._nav.push(page)
        self._split.set_show_content(True)
        return page

    def pop(self) -> None:
        self._nav.pop()

    def toast(
        self,
        message: str,
        timeout_s: int = 3,
        action_label: str | None = None,
        on_action: Callable[[], None] | None = None,
    ) -> None:
        toast = Adw.Toast(title=message, timeout=timeout_s)
        if action_label and on_action:
            toast.set_button_label(action_label)
            toast.connect("button-clicked", lambda *_: on_action())
        self._toasts.add_toast(toast)

    def _on_close_request(self, _window: Gtk.Window) -> bool:
        if getattr(self.get_application(), "hide_on_close", False):
            self.set_visible(False)
            return True
        return False
