from gi.repository import Adw, Gtk

from ..theme.tokens import DURATIONS


def crossfade_stack(**props) -> Gtk.Stack:
    return Gtk.Stack(transition_type=Gtk.StackTransitionType.CROSSFADE, transition_duration=DURATIONS["normal"], **props)


def revealer(**props) -> Gtk.Revealer:
    return Gtk.Revealer(transition_duration=DURATIONS["normal"], **props)


def view_stack(**props) -> Adw.ViewStack:
    return Adw.ViewStack(enable_transitions=True, transition_duration=DURATIONS["normal"], **props)
