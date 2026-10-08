from dataclasses import dataclass
from types import MappingProxyType

ESC = "\x1b"
CSI = ESC + "["
SS3 = ESC + "O"

FOCUS_IN = CSI + "I"
FOCUS_OUT = CSI + "O"
PASTE_START = CSI + "200~"
PASTE_END = CSI + "201~"

CURSOR_KEYS = MappingProxyType({
    "Up": "A", "Down": "B", "Right": "C", "Left": "D", "Home": "H", "End": "F",
    "KP_Up": "A", "KP_Down": "B", "KP_Right": "C", "KP_Left": "D", "KP_Home": "H", "KP_End": "F",
    "KP_Begin": "E",
})
TILDE_KEYS = MappingProxyType({
    "Insert": 2, "Delete": 3, "Page_Up": 5, "Page_Down": 6,
    "KP_Insert": 2, "KP_Delete": 3, "KP_Page_Up": 5, "KP_Prior": 5, "KP_Page_Down": 6, "KP_Next": 6,
    "Prior": 5, "Next": 6,
    "F5": 15, "F6": 17, "F7": 18, "F8": 19, "F9": 20, "F10": 21, "F11": 23, "F12": 24,
})
SS3_FUNCTION_KEYS = MappingProxyType({"F1": "P", "F2": "Q", "F3": "R", "F4": "S"})
KEYPAD_APPLICATION = MappingProxyType({
    "KP_0": "p", "KP_1": "q", "KP_2": "r", "KP_3": "s", "KP_4": "t", "KP_5": "u", "KP_6": "v", "KP_7": "w",
    "KP_8": "x", "KP_9": "y", "KP_Decimal": "n", "KP_Separator": "l", "KP_Add": "k", "KP_Subtract": "m",
    "KP_Multiply": "j", "KP_Divide": "o", "KP_Enter": "M",
})
CONTROL_SYMBOLS = MappingProxyType({
    "@": "\x00", " ": "\x00", "2": "\x00", "[": "\x1b", "3": "\x1b", "\\": "\x1c", "4": "\x1c",
    "]": "\x1d", "5": "\x1d", "^": "\x1e", "6": "\x1e", "_": "\x1f", "7": "\x1f", "/": "\x1f",
    "8": "\x7f", "?": "\x7f",
})
ENTER_KEYS = frozenset(("Return", "KP_Enter", "ISO_Enter"))
TAB_KEYS = frozenset(("Tab", "KP_Tab", "ISO_Left_Tab"))

WHEEL_UP = 64
WHEEL_DOWN = 65
WHEEL_LEFT = 66
WHEEL_RIGHT = 67
NO_BUTTON = 3
LEGACY_LIMIT = 223


@dataclass(frozen=True)
class Modifiers:
    shift: bool = False
    ctrl: bool = False
    alt: bool = False

    @property
    def code(self) -> int:
        return 1 + int(self.shift) + 2 * int(self.alt) + 4 * int(self.ctrl)


def encode_key(
    name: str, char: str, mods: Modifiers = Modifiers(), app_cursor: bool = False, app_keypad: bool = False
) -> str | None:
    code = mods.code
    if name in CURSOR_KEYS:
        final = CURSOR_KEYS[name]
        if code > 1:
            return f"{CSI}1;{code}{final}"
        return (SS3 if app_cursor else CSI) + final
    if name in TILDE_KEYS:
        number = TILDE_KEYS[name]
        return f"{CSI}{number};{code}~" if code > 1 else f"{CSI}{number}~"
    if name in SS3_FUNCTION_KEYS:
        final = SS3_FUNCTION_KEYS[name]
        return f"{CSI}1;{code}{final}" if code > 1 else SS3 + final
    if app_keypad and name in KEYPAD_APPLICATION and not mods.ctrl and not mods.alt:
        return SS3 + KEYPAD_APPLICATION[name]
    if name in ENTER_KEYS:
        return ESC + "\r" if mods.alt or mods.shift else "\r"
    if name == "BackSpace":
        if mods.ctrl:
            return "\x08"
        return ESC + "\x7f" if mods.alt else "\x7f"
    if name in TAB_KEYS:
        if mods.shift or name == "ISO_Left_Tab":
            return CSI + "Z"
        return ESC + "\t" if mods.alt else "\t"
    if name == "Escape":
        return ESC
    if not char:
        return None
    if mods.ctrl:
        control = _control(char)
        if control is None:
            return None
        return ESC + control if mods.alt else control
    if mods.alt:
        return ESC + char
    return char


def _control(char: str) -> str | None:
    lower = char.lower()
    if len(lower) == 1 and "a" <= lower <= "z":
        return chr(ord(lower) - 96)
    return CONTROL_SYMBOLS.get(char)


def encode_mouse(
    button: int, col: int, row: int, pressed: bool, motion: bool = False, mods: Modifiers = Modifiers(), sgr: bool = True
) -> str | None:
    flags = (4 if mods.shift else 0) | (8 if mods.alt else 0) | (16 if mods.ctrl else 0) | (32 if motion else 0)
    if sgr:
        return f"{CSI}<{button | flags};{col + 1};{row + 1}{'M' if pressed else 'm'}"
    if col + 1 > LEGACY_LIMIT or row + 1 > LEGACY_LIMIT:
        return None
    code = (button if pressed or button >= WHEEL_UP else NO_BUTTON) | flags
    return f"{CSI}M{chr(32 + code)}{chr(33 + col)}{chr(33 + row)}"


def encode_paste(text: str, bracketed: bool) -> str:
    text = text.replace("\r\n", "\r").replace("\n", "\r")
    if not bracketed:
        return text
    return PASTE_START + text.replace(PASTE_END, "").replace(PASTE_START, "") + PASTE_END
