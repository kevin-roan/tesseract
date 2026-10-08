from types import MappingProxyType

XK_TAB = 0xFF09
XK_ISO_LEFT_TAB = 0xFE20
XK_SHIFT_L = 0xFFE1
XK_CONTROL_L = 0xFFE3
XK_ALT_L = 0xFFE9
XK_SUPER_L = 0xFFEB
XK_DELETE = 0xFFFF
XK_BACKSPACE = 0xFF08
XK_ESCAPE = 0xFF1B
XK_F4 = 0xFFC1
XK_PRINT = 0xFF61

KEYSYM_ALIASES = MappingProxyType({XK_ISO_LEFT_TAB: XK_TAB})

BUTTON_BITS = MappingProxyType({1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7})
WHEEL_UP, WHEEL_DOWN, WHEEL_LEFT, WHEEL_RIGHT = 4, 5, 6, 7

KEY_COMBOS = MappingProxyType({
    "ctrl-alt-delete": (XK_CONTROL_L, XK_ALT_L, XK_DELETE),
    "ctrl-alt-backspace": (XK_CONTROL_L, XK_ALT_L, XK_BACKSPACE),
    "alt-tab": (XK_ALT_L, XK_TAB),
    "alt-f4": (XK_ALT_L, XK_F4),
    "super": (XK_SUPER_L,),
    "escape": (XK_ESCAPE,),
    "print": (XK_PRINT,),
})


def keysym_for(keyval: int) -> int:
    return KEYSYM_ALIASES.get(keyval, keyval)


def button_bit(button: int) -> int:
    bit = BUTTON_BITS.get(button)
    return 0 if bit is None else 1 << bit


def combo_events(keysyms: tuple[int, ...]) -> list[tuple[int, bool]]:
    return [(keysym, True) for keysym in keysyms] + [(keysym, False) for keysym in reversed(keysyms)]


class WheelAccumulator:
    def __init__(self) -> None:
        self._dx = 0.0
        self._dy = 0.0

    def reset(self) -> None:
        self._dx = self._dy = 0.0

    def clicks(self, dx: float, dy: float) -> list[int]:
        self._dx += dx
        self._dy += dy
        buttons: list[int] = []
        while self._dy <= -1:
            buttons.append(WHEEL_UP)
            self._dy += 1
        while self._dy >= 1:
            buttons.append(WHEEL_DOWN)
            self._dy -= 1
        while self._dx <= -1:
            buttons.append(WHEEL_LEFT)
            self._dx += 1
        while self._dx >= 1:
            buttons.append(WHEEL_RIGHT)
            self._dx -= 1
        return buttons


class KeyTracker:
    def __init__(self) -> None:
        self._down: dict[int, int] = {}

    def press(self, keycode: int, keysym: int) -> int:
        if keycode in self._down:
            return self._down[keycode]
        self._down[keycode] = keysym
        return keysym

    def release(self, keycode: int) -> int | None:
        return self._down.pop(keycode, None)

    def release_all(self) -> list[int]:
        keysyms = list(reversed(self._down.values()))
        self._down.clear()
        return keysyms


def fit_geometry(
    fb_width: int, fb_height: int, view_width: float, view_height: float, fit: bool
) -> tuple[float, float, float]:
    if fb_width <= 0 or fb_height <= 0 or view_width <= 0 or view_height <= 0:
        return 1.0, 0.0, 0.0
    scale = min(view_width / fb_width, view_height / fb_height) if fit else 1.0
    offset_x = max(0.0, float(round((view_width - fb_width * scale) / 2)))
    offset_y = max(0.0, float(round((view_height - fb_height * scale) / 2)))
    return scale, offset_x, offset_y


def to_framebuffer(
    x: float, y: float, geometry: tuple[float, float, float], fb_width: int, fb_height: int
) -> tuple[int, int]:
    scale, offset_x, offset_y = geometry
    fx = int((x - offset_x) / scale)
    fy = int((y - offset_y) / scale)
    return min(max(0, fx), max(0, fb_width - 1)), min(max(0, fy), max(0, fb_height - 1))
