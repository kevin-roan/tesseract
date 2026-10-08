from collections.abc import Callable

from gi.repository import Adw, Gtk

from ...vnc.view import VncView
from ...widgets import EmptyState
from .model import OverlayModel

DIMMED = "dimmed"
CARD_WIDTH = 420
CARD_MARGIN = 28


class DisplayStage(Gtk.Overlay):
    def __init__(self, view: VncView, on_overlay_action: Callable[[], None]) -> None:
        super().__init__(hexpand=True, vexpand=True, css_classes=["to-display-stage"], overflow=Gtk.Overflow.HIDDEN)
        self.view = view
        self._on_overlay_action = on_overlay_action
        viewport = Gtk.Viewport(child=view, scroll_to_focus=False)
        self._scroller = Gtk.ScrolledWindow(child=viewport, hexpand=True, vexpand=True)
        self.set_child(self._scroller)
        self._status = EmptyState("")
        for side in ("top", "bottom", "start", "end"):
            getattr(self._status, f"set_margin_{side}")(CARD_MARGIN)
        self._card = Adw.Clamp(
            maximum_size=CARD_WIDTH,
            child=self._status,
            halign=Gtk.Align.CENTER,
            valign=Gtk.Align.CENTER,
            css_classes=["to-display-overlay"],
        )
        self._card.set_visible(False)
        self.add_overlay(self._card)
        self.set_fit(view.fit)

    def set_fit(self, fit: bool) -> None:
        self.view.set_fit(fit)
        policy = Gtk.PolicyType.EXTERNAL if fit else Gtk.PolicyType.AUTOMATIC
        self._scroller.set_policy(policy, policy)

    def set_overlay(self, model: OverlayModel | None) -> None:
        self._card.set_visible(model is not None)
        if model is None:
            self.view.remove_css_class(DIMMED)
            return
        self.view.add_css_class(DIMMED)
        self._status.set_content(
            model.title,
            model.message,
            None,
            model.loading,
            model.action_label,
            self._on_overlay_action if model.action_label else None,
        )
