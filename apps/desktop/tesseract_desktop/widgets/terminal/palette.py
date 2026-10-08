from dataclasses import dataclass
from functools import cached_property
from types import MappingProxyType

from .cells import DEFAULT_COLOR, color_rgb, is_truecolor

RGB = tuple[int, int, int]

CUBE_LEVELS = (0, 95, 135, 175, 215, 255)


def hex_rgb(value: str) -> RGB:
    value = value.lstrip("#")
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)


def extended_color(index: int) -> RGB:
    if index < 232:
        index -= 16
        return CUBE_LEVELS[index // 36], CUBE_LEVELS[(index // 6) % 6], CUBE_LEVELS[index % 6]
    level = 8 + (index - 232) * 10
    return level, level, level


@dataclass(frozen=True)
class TerminalPalette:
    foreground: str
    background: str
    cursor: str
    cursor_text: str
    selection: str
    ansi: tuple[str, ...]

    @cached_property
    def table(self) -> tuple[RGB, ...]:
        return tuple(hex_rgb(c) for c in self.ansi) + tuple(extended_color(i) for i in range(16, 256))

    @cached_property
    def fg_rgb(self) -> RGB:
        return hex_rgb(self.foreground)

    @cached_property
    def bg_rgb(self) -> RGB:
        return hex_rgb(self.background)

    @cached_property
    def cursor_rgb(self) -> RGB:
        return hex_rgb(self.cursor)

    @cached_property
    def cursor_text_rgb(self) -> RGB:
        return hex_rgb(self.cursor_text)

    @cached_property
    def selection_rgb(self) -> RGB:
        return hex_rgb(self.selection)

    def resolve(self, color: int, default: RGB) -> RGB:
        if color == DEFAULT_COLOR:
            return default
        if is_truecolor(color):
            return color_rgb(color)
        return self.table[color & 0xFF]


PALETTES = MappingProxyType({
    "dark": TerminalPalette(
        foreground="#d6deeb",
        background="#0b0e14",
        cursor="#82aaff",
        cursor_text="#0b0e14",
        selection="#2b3a5a",
        ansi=(
            "#1d2433", "#ef5350", "#9ccc65", "#ffcb6b", "#82aaff", "#c792ea", "#7fdbca", "#d6deeb",
            "#5f6b85", "#ff6e6e", "#c3e88d", "#ffe08a", "#a6c8ff", "#e0b0ff", "#a3f7ea", "#ffffff",
        ),
    ),
    "graphite": TerminalPalette(
        foreground="#E3E3E4",
        background="#09090A",
        cursor="#E3E3E4",
        cursor_text="#09090A",
        selection="#2A2C45",
        ansi=(
            "#222222", "#FF6369", "#3DD68C", "#F2C55C", "#7FB8FA", "#C47BEA", "#7FD6C8", "#D4D4D4",
            "#7A7A7A", "#FF6E6E", "#c3e88d", "#ffe08a", "#a6c8ff", "#E7AEF8", "#a3f7ea", "#ffffff",
        ),
    ),
    "graphiteLight": TerminalPalette(
        foreground="#1B1B1F",
        background="#FFFFFF",
        cursor="#5E6AD2",
        cursor_text="#FFFFFF",
        selection="#D9DCF5",
        ansi=(
            "#1B1B1F", "#C93A3A", "#2E8A5B", "#8F6400", "#1F6FCB", "#8A4FD8", "#1B7C83", "#6B6B6F",
            "#5C5D66", "#A40E26", "#1A7F37", "#7D5800", "#0969DA", "#A475F9", "#3192AA", "#929294",
        ),
    ),
    "light": TerminalPalette(
        foreground="#24292f",
        background="#fbfbfd",
        cursor="#4b5bd6",
        cursor_text="#fbfbfd",
        selection="#cdd6f7",
        ansi=(
            "#24292f", "#cf222e", "#116329", "#8a6100", "#0550ae", "#8250df", "#1b7c83", "#6e7781",
            "#57606a", "#a40e26", "#1a7f37", "#7d5800", "#0969da", "#a475f9", "#3192aa", "#8c959f",
        ),
    ),
})


def palette_for(scheme: str) -> TerminalPalette:
    return PALETTES.get(scheme, PALETTES["dark"])
