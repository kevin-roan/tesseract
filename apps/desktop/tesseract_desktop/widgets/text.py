from gi.repository import Gtk, Pango

from ..theme.css import PREFIX, kebab


def variant_class(variant: str) -> str:
    return f"{PREFIX}-text-{kebab(variant)}"


def color_class(color: str) -> str:
    return f"{PREFIX}-fg-{kebab(color)}"


class Text(Gtk.Label):
    def __init__(
        self,
        text: str = "",
        variant: str = "body",
        color: str = "text",
        wrap: bool = False,
        lines: int | None = 1,
        xalign: float = 0.0,
        selectable: bool = False,
        center: bool = False,
    ) -> None:
        super().__init__(label=text, xalign=0.5 if center else xalign, selectable=selectable)
        self._variant = variant
        self._color = color
        self.add_css_class(variant_class(variant))
        self.add_css_class(color_class(color))
        if center:
            self.set_justify(Gtk.Justification.CENTER)
        if wrap:
            self.set_wrap(True)
            self.set_wrap_mode(Pango.WrapMode.WORD_CHAR)
            if lines:
                self.set_lines(lines)
                self.set_ellipsize(Pango.EllipsizeMode.END)
        elif lines:
            self.set_ellipsize(Pango.EllipsizeMode.END)
            self.set_single_line_mode(lines == 1)

    def set_text_value(self, text: str | None) -> None:
        self.set_label(text or "")
        self.set_visible(bool(text))

    def set_variant(self, variant: str) -> None:
        self.remove_css_class(variant_class(self._variant))
        self._variant = variant
        self.add_css_class(variant_class(variant))

    def set_color(self, color: str) -> None:
        self.remove_css_class(color_class(self._color))
        self._color = color
        self.add_css_class(color_class(color))
