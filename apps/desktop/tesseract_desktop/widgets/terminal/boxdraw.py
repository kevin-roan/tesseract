import math
from types import MappingProxyType

LIGHT = 1
HEAVY = 2

LINES = MappingProxyType({
    "─": (0, 1, 0, 1), "━": (0, 2, 0, 2), "│": (1, 0, 1, 0), "┃": (2, 0, 2, 0),
    "┌": (0, 1, 1, 0), "┍": (0, 2, 1, 0), "┎": (0, 1, 2, 0), "┏": (0, 2, 2, 0),
    "┐": (0, 0, 1, 1), "┑": (0, 0, 1, 2), "┒": (0, 0, 2, 1), "┓": (0, 0, 2, 2),
    "└": (1, 1, 0, 0), "┕": (1, 2, 0, 0), "┖": (2, 1, 0, 0), "┗": (2, 2, 0, 0),
    "┘": (1, 0, 0, 1), "┙": (1, 0, 0, 2), "┚": (2, 0, 0, 1), "┛": (2, 0, 0, 2),
    "├": (1, 1, 1, 0), "┝": (1, 2, 1, 0), "┠": (2, 1, 2, 0), "┣": (2, 2, 2, 0),
    "┤": (1, 0, 1, 1), "┥": (1, 0, 1, 2), "┨": (2, 0, 2, 1), "┫": (2, 0, 2, 2),
    "┬": (0, 1, 1, 1), "┯": (0, 2, 1, 2), "┰": (0, 1, 2, 1), "┳": (0, 2, 2, 2),
    "┴": (1, 1, 0, 1), "┷": (1, 2, 0, 2), "┸": (2, 1, 0, 1), "┻": (2, 2, 0, 2),
    "┼": (1, 1, 1, 1), "┿": (1, 2, 1, 2), "╂": (2, 1, 2, 1), "╋": (2, 2, 2, 2),
    "╴": (0, 0, 0, 1), "╵": (1, 0, 0, 0), "╶": (0, 1, 0, 0), "╷": (0, 0, 1, 0),
    "╸": (0, 0, 0, 2), "╹": (2, 0, 0, 0), "╺": (0, 2, 0, 0), "╻": (0, 0, 2, 0),
    "╼": (0, 2, 0, 1), "╽": (1, 0, 2, 0), "╾": (0, 1, 0, 2), "╿": (2, 0, 1, 0),
})

ARCS = MappingProxyType({"╭": (1, 1), "╮": (-1, 1), "╯": (-1, -1), "╰": (1, -1)})

BLOCKS = MappingProxyType({
    "█": (0, 0, 8, 8), "▀": (0, 0, 8, 4), "▄": (0, 4, 8, 8), "▌": (0, 0, 4, 8), "▐": (4, 0, 8, 8),
    "▁": (0, 7, 8, 8), "▂": (0, 6, 8, 8), "▃": (0, 5, 8, 8), "▅": (0, 3, 8, 8), "▆": (0, 2, 8, 8),
    "▇": (0, 1, 8, 8), "▉": (0, 0, 7, 8), "▊": (0, 0, 6, 8), "▋": (0, 0, 5, 8), "▍": (0, 0, 3, 8),
    "▎": (0, 0, 2, 8), "▏": (0, 0, 1, 8), "▔": (0, 0, 8, 1), "▕": (7, 0, 8, 8),
})

QUADRANTS = MappingProxyType({
    "▖": (0, 0, 1, 0), "▗": (0, 0, 0, 1), "▘": (1, 0, 0, 0), "▝": (0, 1, 0, 0),
    "▙": (1, 0, 1, 1), "▚": (1, 0, 0, 1), "▛": (1, 1, 1, 0), "▜": (1, 1, 0, 1),
    "▞": (0, 1, 1, 0), "▟": (0, 1, 1, 1),
})

SHADES = MappingProxyType({"░": 0.25, "▒": 0.5, "▓": 0.75})


def is_drawable(char: str) -> bool:
    return char in LINES or char in ARCS or char in BLOCKS or char in QUADRANTS or char in SHADES


def line_width(cell_height: float, weight: int) -> float:
    light = max(1.0, round(cell_height / 17))
    return light * (2 if weight == HEAVY else 1)


def draw(cr, char: str, x: float, y: float, width: float, height: float) -> None:
    if char in BLOCKS:
        left, top, right, bottom = BLOCKS[char]
        cr.rectangle(x + width * left / 8, y + height * top / 8, width * (right - left) / 8, height * (bottom - top) / 8)
        cr.fill()
    elif char in QUADRANTS:
        half_w, half_h = width / 2, height / 2
        for index, filled in enumerate(QUADRANTS[char]):
            if filled:
                cr.rectangle(x + half_w * (index % 2), y + half_h * (index // 2), half_w, half_h)
        cr.fill()
    elif char in SHADES:
        _shade(cr, x, y, width, height, SHADES[char])
    elif char in LINES:
        _lines(cr, LINES[char], x, y, width, height)
    elif char in ARCS:
        _arc(cr, ARCS[char], x, y, width, height)


def _shade(cr, x: float, y: float, width: float, height: float, alpha: float) -> None:
    cr.save()
    cr.rectangle(x, y, width, height)
    cr.clip()
    cr.paint_with_alpha(alpha)
    cr.restore()


def _center(x: float, y: float, width: float, height: float, stroke: float) -> tuple[float, float]:
    cx = math.floor(x + width / 2 - stroke / 2)
    cy = math.floor(y + height / 2 - stroke / 2)
    return cx, cy


def _lines(cr, arms: tuple[int, int, int, int], x: float, y: float, width: float, height: float) -> None:
    up, right, down, left = arms
    heavy = line_width(height, HEAVY)
    light = line_width(height, LIGHT)
    left_edge, right_edge = math.floor(x), math.ceil(x + width)
    top_edge, bottom_edge = math.floor(y), math.ceil(y + height)
    for weight, horizontal, start_is_edge in ((left, True, True), (right, True, False), (up, False, True), (down, False, False)):
        if not weight:
            continue
        stroke = heavy if weight == HEAVY else light
        cx, cy = _center(x, y, width, height, stroke)
        cross = max(heavy if weight == HEAVY else light, heavy if max(up, down, left, right) == HEAVY else light)
        if horizontal:
            other_cx, _ = _center(x, y, width, height, cross)
            if start_is_edge:
                cr.rectangle(left_edge, cy, other_cx + cross - left_edge, stroke)
            else:
                cr.rectangle(other_cx, cy, right_edge - other_cx, stroke)
        else:
            _, other_cy = _center(x, y, width, height, cross)
            if start_is_edge:
                cr.rectangle(cx, top_edge, stroke, other_cy + cross - top_edge)
            else:
                cr.rectangle(cx, other_cy, stroke, bottom_edge - other_cy)
    cr.fill()


def _arc(cr, direction: tuple[int, int], x: float, y: float, width: float, height: float) -> None:
    dx, dy = direction
    stroke = line_width(height, LIGHT)
    cx, cy = _center(x, y, width, height, stroke)
    cx += stroke / 2
    cy += stroke / 2
    radius = min(width, height) / 2
    edge_x = math.ceil(x + width) if dx > 0 else math.floor(x)
    edge_y = math.ceil(y + height) if dy > 0 else math.floor(y)
    cr.save()
    cr.set_line_width(stroke)
    cr.move_to(edge_x, cy)
    cr.line_to(cx + dx * radius, cy)
    cr.curve_to(cx + dx * radius * 0.45, cy, cx, cy + dy * radius * 0.45, cx, cy + dy * radius)
    cr.line_to(cx, edge_y)
    cr.stroke()
    cr.restore()
