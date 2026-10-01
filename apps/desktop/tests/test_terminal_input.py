from monolith_desktop.widgets.terminal.cells import Line
from monolith_desktop.widgets.terminal.keys import Modifiers, encode_key, encode_mouse, encode_paste
from monolith_desktop.widgets.terminal.selection import Selection, row_span, selected_text, selection_range

SHIFT = Modifiers(shift=True)
CTRL = Modifiers(ctrl=True)
ALT = Modifiers(alt=True)


def test_basic_keys():
    assert encode_key("Return", "\r") == "\r"
    assert encode_key("KP_Enter", "") == "\r"
    assert encode_key("BackSpace", "") == "\x7f"
    assert encode_key("BackSpace", "", CTRL) == "\x08"
    assert encode_key("BackSpace", "", ALT) == "\x1b\x7f"
    assert encode_key("Tab", "\t") == "\t"
    assert encode_key("ISO_Left_Tab", "", SHIFT) == "\x1b[Z"
    assert encode_key("Escape", "") == "\x1b"
    assert encode_key("Return", "", SHIFT) == "\x1b\r"


def test_cursor_keys_respect_decckm():
    assert encode_key("Up", "") == "\x1b[A"
    assert encode_key("Up", "", app_cursor=True) == "\x1bOA"
    assert encode_key("Left", "", CTRL, app_cursor=True) == "\x1b[1;5D"
    assert encode_key("Home", "") == "\x1b[H"
    assert encode_key("End", "", app_cursor=True) == "\x1bOF"
    assert encode_key("Right", "", Modifiers(shift=True, alt=True)) == "\x1b[1;4C"


def test_editing_and_function_keys():
    assert encode_key("Delete", "") == "\x1b[3~"
    assert encode_key("Insert", "") == "\x1b[2~"
    assert encode_key("Page_Up", "") == "\x1b[5~"
    assert encode_key("Page_Down", "", CTRL) == "\x1b[6;5~"
    assert encode_key("F1", "") == "\x1bOP"
    assert encode_key("F4", "", SHIFT) == "\x1b[1;2S"
    assert encode_key("F5", "") == "\x1b[15~"
    assert encode_key("F12", "") == "\x1b[24~"


def test_keypad_application_mode():
    assert encode_key("KP_1", "1") == "1"
    assert encode_key("KP_1", "1", app_keypad=True) == "\x1bOq"
    assert encode_key("KP_Enter", "", app_keypad=True) == "\x1bOM"


def test_control_and_alt_combinations():
    assert encode_key("c", "c", CTRL) == "\x03"
    assert encode_key("C", "C", CTRL) == "\x03"
    assert encode_key("space", " ", CTRL) == "\x00"
    assert encode_key("bracketleft", "[", CTRL) == "\x1b"
    assert encode_key("backslash", "\\", CTRL) == "\x1c"
    assert encode_key("slash", "/", CTRL) == "\x1f"
    assert encode_key("comma", ",", CTRL) is None
    assert encode_key("x", "x", ALT) == "\x1bx"
    assert encode_key("a", "a", Modifiers(ctrl=True, alt=True)) == "\x1b\x01"
    assert encode_key("a", "a") == "a"
    assert encode_key("Shift_L", "") is None


def test_mouse_encoding():
    assert encode_mouse(0, 4, 2, True) == "\x1b[<0;5;3M"
    assert encode_mouse(0, 4, 2, False) == "\x1b[<0;5;3m"
    assert encode_mouse(64, 0, 0, True, mods=CTRL) == "\x1b[<80;1;1M"
    assert encode_mouse(0, 1, 1, True, motion=True) == "\x1b[<32;2;2M"
    assert encode_mouse(0, 0, 0, True, sgr=False) == "\x1b[M !!"
    assert encode_mouse(2, 0, 0, False, sgr=False) == "\x1b[M#!!"
    assert encode_mouse(0, 300, 0, True, sgr=False) is None


def test_paste_encoding():
    assert encode_paste("a\nb\r\nc", False) == "a\rb\rc"
    assert encode_paste("x", True) == "\x1b[200~x\x1b[201~"
    assert encode_paste("evil\x1b[201~rm", True) == "\x1b[200~evilrm\x1b[201~"


def lines(*texts: str) -> dict[int, Line]:
    return {index: Line.from_text(text) for index, text in enumerate(texts)}


def test_char_selection_across_lines():
    table = lines("hello world ", "second line")
    bounds = selection_range(Selection((0, 6), (1, 6)), table.get, 12)
    assert selected_text(bounds, table.get, 12) == "world\nsecond"
    assert row_span(bounds, 0, 12) == (6, 12)
    assert row_span(bounds, 1, 12) == (0, 6)
    assert row_span(bounds, 2, 12) is None


def test_empty_char_selection():
    table = lines("abc")
    assert selection_range(Selection((0, 1), (0, 1)), table.get, 3) is None


def test_reverse_drag_is_normalized():
    table = lines("abcdef")
    bounds = selection_range(Selection((0, 4), (0, 1)), table.get, 6)
    assert selected_text(bounds, table.get, 6) == "bcd"


def test_word_selection():
    table = lines("cd /usr/local-bin now")
    bounds = selection_range(Selection((0, 6), (0, 6), "word"), table.get, 21)
    assert selected_text(bounds, table.get, 21) == "/usr/local-bin"


def test_line_selection_and_wrapped_lines():
    table = lines("abcdef", "gh")
    table[0].wrapped = True
    bounds = selection_range(Selection((0, 2), (1, 0), "line"), table.get, 6)
    assert selected_text(bounds, table.get, 6) == "abcdefgh"


def test_wide_tail_is_skipped_in_copied_text():
    line = Line.from_text("a中 b")
    line.chars[2] = ""
    table = {0: line}
    bounds = selection_range(Selection((0, 0), (0, 4)), table.get, 4)
    assert selected_text(bounds, table.get, 4) == "a中b"


class FakeApp:
    def __init__(self) -> None:
        self.accels = {
            "app.quit": ["<Control>q"],
            "app.refresh": ["<Control>r", "F5"],
            "app.hide": ["<Control>w"],
            "app.copy": ["<Control><Shift>c"],
            "app.super": ["<Super>k"],
        }

    def list_action_descriptions(self):
        return list(self.accels)

    def get_accels_for_action(self, action):
        return self.accels[action]

    def set_accels_for_action(self, action, accels):
        self.accels[action] = list(accels)


def test_accel_guard_suspends_terminal_keys_and_restores():
    from monolith_desktop.widgets.accel_guard import AccelGuard

    app = FakeApp()
    original = {k: list(v) for k, v in app.accels.items()}
    guard = AccelGuard()
    assert guard.acquire(app)
    assert guard.acquire(app)
    assert app.accels["app.quit"] == [] and app.accels["app.refresh"] == [] and app.accels["app.hide"] == []
    assert app.accels["app.copy"] == ["<Control><Shift>c"] and app.accels["app.super"] == ["<Super>k"]
    guard.release()
    assert app.accels["app.hide"] == []
    guard.release()
    assert app.accels == original
    guard.release()
    assert not guard.acquire(None)
