import math
from collections import OrderedDict
from dataclasses import dataclass

from gi.repository import Pango, PangoCairo

from . import boxdraw
from .cells import (
    BLANK,
    BOLD,
    DIM,
    DOUBLE_UNDERLINE,
    HIDDEN,
    INVERSE,
    ITALIC,
    OVERLINE,
    STRIKE,
    UNDERLINE,
    WIDE_TAIL,
    Line,
    Style,
)
from .config import LAYOUT_CACHE_SIZE, LINE_HEIGHT, ROW_CACHE_SIZE
from .palette import RGB, TerminalPalette

DECORATIONS = UNDERLINE | DOUBLE_UNDERLINE | STRIKE | OVERLINE
Color = tuple[float, float, float]


def to_float(rgb: RGB) -> Color:
    return rgb[0] / 255, rgb[1] / 255, rgb[2] / 255


def blend(a: RGB, b: RGB, amount: float) -> RGB:
    return tuple(round(x + (y - x) * amount) for x, y in zip(a, b))  # type: ignore[return-value]


@dataclass(frozen=True)
class Metrics:
    cell_width: float
    cell_height: int
    baseline: float
    underline_position: float
    underline_thickness: float
    strike_position: float


@dataclass(frozen=True)
class CellColors:
    fg: Color
    bg: Color
    bg_is_default: bool
    variant: int
    decorations: int
    hidden: bool


class Renderer:
    def __init__(self) -> None:
        self._context: Pango.Context | None = None
        self._fonts: list[Pango.FontDescription] = []
        self.metrics = Metrics(8.0, 16, 12.0, 14.0, 1.0, 8.0)
        self._layouts: OrderedDict[tuple[str, int], Pango.Layout] = OrderedDict()
        self._rows: OrderedDict[tuple, list] = OrderedDict()
        self._colors: dict[tuple, CellColors] = {}
        self._palette: TerminalPalette | None = None
        self._reverse = False

    def set_font(self, context: Pango.Context, description: Pango.FontDescription) -> Metrics:
        self._context = context
        variants = []
        for bold, italic in ((False, False), (True, False), (False, True), (True, True)):
            font = description.copy()
            if bold:
                font.set_weight(Pango.Weight.BOLD)
            if italic:
                font.set_style(Pango.Style.ITALIC)
            variants.append(font)
        self._fonts = variants
        probe = Pango.Layout.new(context)
        probe.set_font_description(description)
        probe.set_text("M" * 20, -1)
        _ink, logical = probe.get_extents()
        cell_width = max(1.0, logical.width / 20 / Pango.SCALE)
        font_metrics = context.get_metrics(description, None)
        ascent = font_metrics.get_ascent() / Pango.SCALE
        descent = font_metrics.get_descent() / Pango.SCALE
        natural = max(logical.height / Pango.SCALE, ascent + descent)
        cell_height = max(1, math.ceil(natural * LINE_HEIGHT))
        baseline = round((cell_height - (ascent + descent)) / 2 + ascent)
        thickness = max(1.0, round(font_metrics.get_underline_thickness() / Pango.SCALE))
        underline = baseline - font_metrics.get_underline_position() / Pango.SCALE
        strike = baseline - font_metrics.get_strikethrough_position() / Pango.SCALE
        self.metrics = Metrics(cell_width, cell_height, baseline, min(underline, cell_height - thickness), thickness, strike)
        self.invalidate()
        return self.metrics

    def invalidate(self) -> None:
        self._layouts.clear()
        self._rows.clear()
        self._colors.clear()

    def set_palette(self, palette: TerminalPalette, reverse: bool) -> None:
        if palette is not self._palette or reverse != self._reverse:
            self._palette = palette
            self._reverse = reverse
            self._rows.clear()
            self._colors.clear()

    def defaults(self) -> tuple[RGB, RGB]:
        palette = self._palette
        assert palette is not None
        return (palette.bg_rgb, palette.fg_rgb) if self._reverse else (palette.fg_rgb, palette.bg_rgb)

    def colors(self, style: Style, selected: bool) -> CellColors:
        key = (style, selected)
        cached = self._colors.get(key)
        if cached is not None:
            return cached
        palette = self._palette
        assert palette is not None
        default_fg, default_bg = self.defaults()
        fg = palette.resolve(style.fg, default_fg)
        bg = palette.resolve(style.bg, default_bg)
        bg_default = style.bg < 0
        flags = style.flags
        if flags & INVERSE:
            fg, bg = bg, fg
            bg_default = False
        if flags & DIM:
            fg = blend(fg, bg, 0.45)
        if selected:
            bg = palette.selection_rgb if not self._reverse else blend(palette.selection_rgb, default_bg, 0.3)
            bg_default = False
        variant = (1 if flags & BOLD else 0) + (2 if flags & ITALIC else 0)
        colors = CellColors(to_float(fg), to_float(bg), bg_default, variant, flags & DECORATIONS, bool(flags & HIDDEN))
        self._colors[key] = colors
        return colors

    def row_ops(self, line: Line, cols: int, span: tuple[int, int] | None) -> list:
        chars = line.chars[:cols]
        attrs = line.attrs[:cols]
        key = (tuple(chars), tuple(attrs), span, cols)
        cached = self._rows.get(key)
        if cached is not None:
            self._rows.move_to_end(key)
            return cached
        ops = self._build_ops(chars, attrs, span)
        self._rows[key] = ops
        if len(self._rows) > ROW_CACHE_SIZE:
            self._rows.popitem(last=False)
        return ops

    def _build_ops(self, chars: list[str], attrs: list[Style], span: tuple[int, int] | None) -> list:
        backgrounds: list[tuple] = []
        texts: list[tuple] = []
        run_start = -1
        run_text: list[str] = []
        run_key: tuple | None = None
        bg_start = -1
        bg_color: Color | None = None
        size = len(chars)

        def flush_text() -> None:
            nonlocal run_start, run_key
            if run_key is not None and run_text:
                fg, variant, decorations = run_key
                text = "".join(run_text).rstrip(BLANK) if not decorations else "".join(run_text)
                if text:
                    texts.append(("text", run_start, text, fg, variant, decorations, len(run_text)))
            run_text.clear()
            run_start = -1
            run_key = None

        for x in range(size + 1):
            if x == size:
                if bg_color is not None:
                    backgrounds.append(("bg", bg_start, x, bg_color))
                break
            char = chars[x]
            selected = span is not None and span[0] <= x < span[1]
            colors = self.colors(attrs[x], selected)
            cell_bg = None if colors.bg_is_default else colors.bg
            if cell_bg != bg_color:
                if bg_color is not None:
                    backgrounds.append(("bg", bg_start, x, bg_color))
                bg_color = cell_bg
                bg_start = x
            if char == WIDE_TAIL:
                continue
            visible = not colors.hidden
            key = (colors.fg, colors.variant, colors.decorations)
            if len(char) == 1 and char < "\x7f":
                if char == BLANK and not colors.decorations:
                    if run_key is not None:
                        run_text.append(char)
                    continue
                if not visible:
                    flush_text()
                    continue
                if key != run_key:
                    flush_text()
                    run_key = key
                    run_start = x
                run_text.append(char)
                continue
            flush_text()
            if not visible:
                continue
            width = 2 if x + 1 < size and chars[x + 1] == WIDE_TAIL else 1
            if boxdraw.is_drawable(char):
                texts.append(("box", x, char, colors.fg, width))
            else:
                texts.append(("glyph", x, char, colors.fg, colors.variant, colors.decorations, width))
        flush_text()
        return backgrounds + texts

    def layout(self, text: str, variant: int) -> Pango.Layout:
        key = (text, variant)
        layout = self._layouts.get(key)
        if layout is not None:
            self._layouts.move_to_end(key)
            return layout
        layout = Pango.Layout.new(self._context)
        layout.set_font_description(self._fonts[variant])
        layout.set_text(text, -1)
        self._layouts[key] = layout
        if len(self._layouts) > LAYOUT_CACHE_SIZE:
            self._layouts.popitem(last=False)
        return layout

    def draw_row(self, cr, ops: list, origin_x: float, y: float) -> None:
        metrics = self.metrics
        cell_w = metrics.cell_width
        cell_h = metrics.cell_height
        for op in ops:
            kind = op[0]
            if kind == "bg":
                _, start, end, color = op
                cr.set_source_rgb(*color)
                left = math.floor(origin_x + start * cell_w)
                cr.rectangle(left, y, math.ceil(origin_x + end * cell_w) - left, cell_h)
                cr.fill()
            elif kind == "text":
                _, start, text, fg, variant, decorations, cells = op
                cr.set_source_rgb(*fg)
                x = origin_x + start * cell_w
                layout = self.layout(text, variant)
                cr.move_to(x, y + metrics.baseline - layout.get_baseline() / Pango.SCALE)
                PangoCairo.show_layout(cr, layout)
                if decorations:
                    self._decorate(cr, decorations, x, y, cells * cell_w)
            elif kind == "box":
                _, start, char, fg, width = op
                cr.set_source_rgb(*fg)
                boxdraw.draw(cr, char, origin_x + start * cell_w, y, width * cell_w, cell_h)
            else:
                _, start, char, fg, variant, decorations, width = op
                cr.set_source_rgb(*fg)
                self.draw_glyph(cr, char, variant, origin_x + start * cell_w, y, width)
                if decorations:
                    self._decorate(cr, decorations, origin_x + start * cell_w, y, width * cell_w)

    def draw_glyph(self, cr, char: str, variant: int, x: float, y: float, width: int) -> None:
        metrics = self.metrics
        if boxdraw.is_drawable(char):
            boxdraw.draw(cr, char, x, y, width * metrics.cell_width, metrics.cell_height)
            return
        layout = self.layout(char, variant)
        _ink, logical = layout.get_extents()
        glyph_width = logical.width / Pango.SCALE
        allowed = width * metrics.cell_width
        top = y + metrics.baseline - layout.get_baseline() / Pango.SCALE
        if glyph_width > allowed * 1.05:
            cr.save()
            cr.translate(x, top)
            cr.scale(allowed / glyph_width, 1)
            cr.move_to(0, 0)
            PangoCairo.show_layout(cr, layout)
            cr.restore()
            return
        offset = (allowed - glyph_width) / 2 if width == 2 else 0
        cr.move_to(x + offset, top)
        PangoCairo.show_layout(cr, layout)

    def _decorate(self, cr, decorations: int, x: float, y: float, width: float) -> None:
        metrics = self.metrics
        thickness = metrics.underline_thickness
        if decorations & (UNDERLINE | DOUBLE_UNDERLINE):
            line_y = math.floor(y + metrics.underline_position)
            cr.rectangle(x, line_y, width, thickness)
            if decorations & DOUBLE_UNDERLINE:
                cr.rectangle(x, min(y + metrics.cell_height - thickness, line_y + thickness * 2), width, thickness)
        if decorations & STRIKE:
            cr.rectangle(x, math.floor(y + metrics.strike_position), width, thickness)
        if decorations & OVERLINE:
            cr.rectangle(x, y, width, thickness)
        cr.fill()
