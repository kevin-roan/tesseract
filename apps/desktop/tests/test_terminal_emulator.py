import pytest

from monolith_desktop.widgets.terminal.cells import (
    BOLD,
    DEFAULT_COLOR,
    DIM,
    DOUBLE_UNDERLINE,
    INVERSE,
    ITALIC,
    STRIKE,
    UNDERLINE,
    WIDE_TAIL,
    color_rgb,
    is_truecolor,
)
from monolith_desktop.widgets.terminal.palette import palette_for
from monolith_desktop.widgets.terminal.terminal import Terminal
from monolith_desktop.widgets.terminal.width import char_width


def make(cols: int = 10, rows: int = 5, scrollback: int = 100) -> tuple[Terminal, list[str]]:
    replies: list[str] = []
    return Terminal(cols, rows, scrollback, on_reply=replies.append), replies


def screen(term: Terminal) -> list[str]:
    return [line.text().rstrip() for line in term.lines]


def history(term: Terminal) -> list[str]:
    return [line.text().rstrip() for line in term.primary.scrollback]


def cursor(term: Terminal) -> tuple[int, int]:
    return term.x, term.y


def test_print_and_newline():
    term, _ = make()
    term.feed("hello\r\nworld")
    assert screen(term)[:2] == ["hello", "world"]
    assert cursor(term) == (5, 1)


def test_linefeed_keeps_column_unless_newline_mode():
    term, _ = make()
    term.feed("ab\ncd")
    assert screen(term)[:2] == ["ab", "  cd"]
    term.feed("\x1b[20h\nx")
    assert screen(term)[2] == "x"


def test_utf8_bytes_split_across_chunks():
    term, _ = make()
    data = "é中😀".encode()
    for index in range(len(data)):
        term.feed_bytes(data[index:index + 1])
    assert term.lines[0].chars[:5] == ["é", "中", WIDE_TAIL, "😀", WIDE_TAIL]


def test_pending_wrap_semantics():
    term, _ = make(5, 3)
    term.feed("abcde")
    assert cursor(term) == (4, 0) and term.wrap_pending
    term.feed("\r")
    assert cursor(term) == (0, 0) and not term.wrap_pending
    term.feed("\x1b[5Gabc")
    assert screen(term)[:2] == ["abcda", "bc"]
    assert term.lines[0].wrapped


def test_pending_wrap_cleared_by_cursor_motion():
    term, _ = make(5, 3)
    term.feed("abcde\x1b[D")
    assert not term.wrap_pending and cursor(term) == (3, 0)
    term.feed("X")
    assert screen(term)[0] == "abcXe"


def test_autowrap_disabled_overwrites_last_column():
    term, _ = make(5, 3)
    term.feed("\x1b[?7labcdefg")
    assert screen(term) == ["abcdg", "", ""]
    assert cursor(term) == (4, 0)


def test_scrolls_into_history():
    term, _ = make(5, 3)
    term.feed("1\r\n2\r\n3\r\n4\r\n5")
    assert screen(term) == ["3", "4", "5"]
    assert history(term) == ["1", "2"]
    assert term.primary.pushed == 2


def test_scrollback_limit_tracks_dropped_lines():
    term, _ = make(5, 2, scrollback=3)
    term.feed("\r\n".join(str(i) for i in range(10)))
    assert history(term) == ["5", "6", "7"]
    assert term.primary.dropped == 5
    assert term.primary.line_at(term.primary.first_index).text().rstrip() == "5"


def test_cursor_movement_commands():
    term, _ = make(10, 5)
    term.feed("\x1b[3;4H")
    assert cursor(term) == (3, 2)
    term.feed("\x1b[A")
    assert cursor(term) == (3, 1)
    term.feed("\x1b[2B")
    assert cursor(term) == (3, 3)
    term.feed("\x1b[3C")
    assert cursor(term) == (6, 3)
    term.feed("\x1b[20C")
    assert cursor(term) == (9, 3)
    term.feed("\x1b[4D")
    assert cursor(term) == (5, 3)
    term.feed("\x1b[E")
    assert cursor(term) == (0, 4)
    term.feed("\x1b[2F")
    assert cursor(term) == (0, 2)
    term.feed("\x1b[7G")
    assert cursor(term) == (6, 2)
    term.feed("\x1b[1d")
    assert cursor(term) == (6, 0)
    term.feed("\x1b[5;2f")
    assert cursor(term) == (1, 4)
    term.feed("\x1b[`")
    assert cursor(term) == (0, 4)
    term.feed("\x1b[99;99H")
    assert cursor(term) == (9, 4)
    term.feed("\x1b[H")
    assert cursor(term) == (0, 0)


def test_erase_display_modes():
    term, _ = make(4, 3)
    term.feed("aaaa\r\nbbbb\r\ncccc\x1b[2;3H\x1b[J")
    assert screen(term) == ["aaaa", "bb", ""]
    term.feed("\x1b[H\x1b[3Bx")
    term, _ = make(4, 3)
    term.feed("aaaa\r\nbbbb\r\ncccc\x1b[2;3H\x1b[1J")
    assert screen(term) == ["", "   b", "cccc"]
    term.feed("\x1b[2J")
    assert screen(term) == ["", "", ""]


def test_erase_display_3_clears_history():
    term, _ = make(4, 2)
    term.feed("1\r\n2\r\n3\r\n4")
    assert history(term)
    term.feed("\x1b[3J")
    assert history(term) == []
    assert screen(term) == ["3", "4"]


def test_erase_line_modes():
    term, _ = make(6, 1)
    term.feed("abcdef\x1b[3G\x1b[K")
    assert screen(term) == ["ab"]
    term.feed("\rabcdef\x1b[3G\x1b[1K")
    assert screen(term) == ["   def"]
    term.feed("\x1b[2K")
    assert screen(term) == [""]


def test_erase_uses_background_color():
    term, _ = make(4, 1)
    term.feed("\x1b[44;1m\x1b[2K")
    assert term.lines[0].attrs[0].bg == 4
    assert term.lines[0].attrs[0].flags == 0
    assert term.lines[0].attrs[0].fg == DEFAULT_COLOR


def test_ech_dch_ich():
    term, _ = make(8, 1)
    term.feed("abcdefgh\x1b[3G\x1b[2X")
    assert screen(term) == ["ab  efgh"]
    term.feed("\x1b[2P")
    assert screen(term) == ["abefgh"]
    term.feed("\x1b[3@")
    assert screen(term) == ["ab   efg"]


def test_insert_mode():
    term, _ = make(6, 1)
    term.feed("abcd\x1b[2G\x1b[4hXY\x1b[4l")
    assert screen(term) == ["aXYbcd"]


def test_insert_and_delete_lines():
    term, _ = make(3, 4)
    term.feed("a\r\nb\r\nc\r\nd\x1b[2;1H\x1b[L")
    assert screen(term) == ["a", "", "b", "c"]
    term.feed("\x1b[2M")
    assert screen(term) == ["a", "c", "", ""]


def test_scroll_region_and_index():
    term, _ = make(3, 5)
    term.feed("1\r\n2\r\n3\r\n4\r\n5\x1b[2;4r")
    assert cursor(term) == (0, 0)
    term.feed("\x1b[4;1H\n")
    assert screen(term) == ["1", "3", "4", "", "5"]
    assert history(term) == []
    term.feed("\x1b[2;1H\x1bM")
    assert screen(term) == ["1", "", "3", "4", "5"]


def test_scroll_up_down_commands():
    term, _ = make(3, 3)
    term.feed("1\r\n2\r\n3\x1b[S")
    assert screen(term) == ["2", "3", ""]
    term.feed("\x1b[2T")
    assert screen(term) == ["", "", "2"]


def test_origin_mode():
    term, replies = make(5, 6)
    term.feed("\x1b[3;5r\x1b[?6h")
    assert cursor(term) == (0, 2)
    term.feed("\x1b[10;1H")
    assert cursor(term) == (0, 4)
    term.feed("\x1b[6n")
    assert replies[-1] == "\x1b[3;1R"
    term.feed("\x1b[?6l")
    assert cursor(term) == (0, 0)


def test_tabs():
    term, _ = make(20, 1)
    term.feed("a\tb")
    assert cursor(term) == (9, 0)
    term.feed("\x1b[3g\x1b[5G\x1bH\r\t")
    assert cursor(term) == (4, 0)
    term.feed("\t")
    assert cursor(term) == (19, 0)
    term.feed("\x1b[Z")
    assert cursor(term) == (4, 0)
    term.feed("\x1b[g\r\t")
    assert cursor(term) == (19, 0)


def test_cht_and_cbt_defaults():
    term, _ = make(30, 1)
    term.feed("\x1b[2I")
    assert cursor(term) == (16, 0)
    term.feed("\x1b[2Z")
    assert cursor(term) == (0, 0)


def test_save_restore_cursor():
    term, _ = make(10, 5)
    term.feed("\x1b[2;3H\x1b[31m\x1b7\x1b[H\x1b[0m\x1b8x")
    assert screen(term)[1] == "  x"
    assert term.lines[1].attrs[2].fg == 1
    term.feed("\x1b[4;4H\x1b[s\x1b[H\x1b[u")
    assert cursor(term) == (3, 3)


def test_restore_without_save_homes():
    term, _ = make()
    term.feed("\x1b[3;3H\x1b8")
    assert cursor(term) == (0, 0)


def test_ri_ind_nel():
    term, _ = make(3, 3)
    term.feed("a\x1bD")
    assert cursor(term) == (1, 1)
    term.feed("\x1bE")
    assert cursor(term) == (0, 2)
    term.feed("\x1b[H\x1bM")
    assert screen(term)[0] == ""
    assert screen(term)[1] == "a"


def test_sgr_attributes():
    term, _ = make()
    term.feed("\x1b[1;2;3;4;7;9mx")
    flags = term.lines[0].attrs[0].flags
    assert flags & BOLD and flags & DIM and flags & ITALIC and flags & UNDERLINE and flags & INVERSE and flags & STRIKE
    term.feed("\x1b[22;23;24;27;29my")
    assert term.lines[0].attrs[1].flags == 0
    term.feed("\x1b[4:2mz\x1b[4:0mw")
    assert term.lines[0].attrs[2].flags == DOUBLE_UNDERLINE
    assert term.lines[0].attrs[3].flags == 0


def test_sgr_colors():
    term, _ = make(12, 1)
    term.feed("\x1b[31;42ma\x1b[91;102mb\x1b[38;5;208;48;5;17mc\x1b[38;2;10;20;30md\x1b[38:2::1:2:3me\x1b[38:5:99mf")
    attrs = term.lines[0].attrs
    assert (attrs[0].fg, attrs[0].bg) == (1, 2)
    assert (attrs[1].fg, attrs[1].bg) == (9, 10)
    assert (attrs[2].fg, attrs[2].bg) == (208, 17)
    assert is_truecolor(attrs[3].fg) and color_rgb(attrs[3].fg) == (10, 20, 30)
    assert color_rgb(attrs[4].fg) == (1, 2, 3)
    assert attrs[5].fg == 99
    term.feed("\x1b[39;49mg\x1b[mh")
    assert (attrs[6].fg, attrs[6].bg) == (DEFAULT_COLOR, DEFAULT_COLOR)


def test_sgr_truecolor_followed_by_attribute():
    term, _ = make()
    term.feed("\x1b[38;2;1;2;3;1mx")
    style = term.lines[0].attrs[0]
    assert color_rgb(style.fg) == (1, 2, 3) and style.flags & BOLD


def test_private_sgr_is_not_applied():
    term, _ = make()
    term.feed("\x1b[>4;2mx")
    assert term.lines[0].attrs[0].flags == 0


def test_wide_characters():
    term, _ = make(6, 2)
    term.feed("a中b")
    assert term.lines[0].chars[:4] == ["a", "中", WIDE_TAIL, "b"]
    assert cursor(term) == (4, 0)


def test_wide_character_wraps_at_last_column():
    term, _ = make(4, 2)
    term.feed("abc中")
    assert screen(term)[0] == "abc"
    assert term.lines[1].chars[:2] == ["中", WIDE_TAIL]
    assert term.lines[0].wrapped


def test_overwriting_half_of_wide_char_clears_other_half():
    term, _ = make(6, 1)
    term.feed("中文\x1b[2Gx")
    assert term.lines[0].chars[:4] == [" ", "x", "文", WIDE_TAIL]
    term.feed("\x1b[3Gy")
    assert term.lines[0].chars[:4] == [" ", "x", "y", " "]


def test_combining_characters_join_previous_cell():
    term, _ = make()
    term.feed("éx")
    assert term.lines[0].chars[:2] == ["é", "x"]
    term.feed("\r中́")
    assert term.lines[0].chars[0] == "中́"


def test_char_width_table():
    assert char_width("a") == 1
    assert char_width("中") == 2
    assert char_width("😀") == 2
    assert char_width("́") == 0
    assert char_width("​") == 0
    assert char_width("─") == 1
    assert char_width("❯") == 1


def test_c1_controls_are_dropped():
    term, _ = make()
    term.feed("a\u0085b")
    assert screen(term)[0] == "ab"


def test_alternate_screen_1049():
    term, _ = make(5, 3)
    term.feed("main\x1b[2;2H\x1b[?1049h")
    assert term.alt_screen
    assert screen(term) == ["", "", ""]
    term.feed("alt")
    term.feed("\x1b[?1049l")
    assert not term.alt_screen
    assert screen(term)[0] == "main"
    assert cursor(term) == (1, 1)


def test_alternate_screen_47_and_1047():
    term, _ = make(5, 2)
    term.feed("x\x1b[?47hy\x1b[?47l")
    assert screen(term)[0] == "x"
    term.feed("\x1b[?1047hz\x1b[?1047l\x1b[?1047h")
    assert screen(term)[0] == ""


def test_alternate_screen_has_no_history():
    term, _ = make(3, 2)
    term.feed("\x1b[?1049h1\r\n2\r\n3\r\n4")
    assert history(term) == []
    assert term.buffer.history == 0


def test_cursor_visibility_and_style():
    term, _ = make()
    term.feed("\x1b[?25l")
    assert not term.cursor_visible
    term.feed("\x1b[?25h\x1b[6 q")
    assert term.cursor_visible and term.cursor_shape == "bar" and not term.cursor_blink
    term.feed("\x1b[3 q")
    assert term.cursor_shape == "underline" and term.cursor_blink
    term.feed("\x1b[0 q")
    assert term.cursor_shape == "block"


def test_input_modes():
    term, _ = make()
    term.feed("\x1b[?1h\x1b=\x1b[?2004h\x1b[?1004h\x1b[?1002h\x1b[?1006h")
    assert term.app_cursor and term.app_keypad and term.bracketed_paste and term.focus_events
    assert term.mouse_mode == 1002 and term.mouse_sgr
    term.feed("\x1b[?1l\x1b>\x1b[?2004l\x1b[?1004l\x1b[?1002l\x1b[?1006l")
    assert not (term.app_cursor or term.app_keypad or term.bracketed_paste or term.focus_events)
    assert term.mouse_mode == 0 and not term.mouse_sgr


def test_synchronized_output_mode_tracked():
    term, _ = make()
    term.feed("\x1b[?2026h")
    assert term.synchronized
    term.feed("\x1b[?2026l")
    assert not term.synchronized


@pytest.mark.parametrize(
    ("query", "reply"),
    [
        ("\x1b[5n", "\x1b[0n"),
        ("\x1b[c", "\x1b[?62;22c"),
        ("\x1b[0c", "\x1b[?62;22c"),
        ("\x1b[>c", "\x1b[>1;10;0c"),
        ("\x1b[?2004$p", "\x1b[?2004;2$y"),
        ("\x1b[?9999$p", "\x1b[?9999;0$y"),
        ("\x1b[4$p", "\x1b[4;2$y"),
        ("\x1b[18t", "\x1b[8;5;10t"),
    ],
)
def test_device_queries(query: str, reply: str):
    term, replies = make(10, 5)
    term.feed(query)
    assert replies == [reply]


def test_cursor_position_reports():
    term, replies = make()
    term.feed("\x1b[3;7H\x1b[6n\x1b[?6n")
    assert replies == ["\x1b[3;7R", "\x1b[?3;7R"]


def test_osc_title_and_color_queries():
    titles: list[str] = []
    replies: list[str] = []
    term = Terminal(10, 3, on_reply=replies.append, on_title=titles.append, palette=palette_for("dark"))
    term.feed("\x1b]0;hello\x07\x1b]2;world\x1b\\")
    assert titles == ["hello", "world"] and term.title == "world"
    term.feed("\x1b]11;?\x07\x1b]10;?\x1b\\\x1b]4;1;?\x07")
    assert replies[0] == "\x1b]11;rgb:0b0b/0e0e/1414\x07"
    assert replies[1] == "\x1b]10;rgb:d6d6/dede/ebeb\x1b\\"
    assert replies[2] == "\x1b]4;1;rgb:efef/5353/5050\x07"


def test_osc_cwd_and_hyperlinks():
    term, _ = make(20, 1)
    term.feed("\x1b]7;file://host/tmp\x07\x1b]8;id=1;http://x\x07link\x1b]8;;\x07")
    assert term.cwd == "file://host/tmp"
    assert screen(term)[0] == "link"


def test_dec_special_graphics():
    term, _ = make()
    term.feed("\x1b(0lqk\x1b(Bq")
    assert screen(term)[0] == "┌─┐q"
    term.feed("\r\x1b)0\x0eqx\x0fq")
    assert screen(term)[0] == "─│qq"


def test_repeat_last_character():
    term, _ = make()
    term.feed("ab\x1b[3b")
    assert screen(term)[0] == "abbbb"


def test_decaln():
    term, _ = make(3, 2)
    term.feed("\x1b#8")
    assert screen(term) == ["EEE", "EEE"]


def test_soft_reset():
    term, _ = make()
    term.feed("\x1b[?25l\x1b[4h\x1b[?6h\x1b[31m\x1b[2;3r\x1b[!p")
    assert term.cursor_visible and not term.insert_mode and not term.origin
    assert term.style.fg == DEFAULT_COLOR and (term.top, term.bottom) == (0, 4)


def test_full_reset_keeps_history_but_clears_screen():
    term, _ = make(3, 2)
    term.feed("1\r\n2\r\n3\x1b[?1h\x1bc")
    assert screen(term) == ["", ""]
    assert history(term) == ["1"]
    assert not term.app_cursor and cursor(term) == (0, 0)


def test_reset_for_replay_clears_everything():
    term, _ = make(3, 2)
    term.feed("1\r\n2\r\n3\x1b[?1049h\x1b[31")
    term.reset()
    assert history(term) == [] and not term.alt_screen
    term.feed("m")
    assert screen(term)[0] == "m"


def test_resize_shrink_rows_pushes_top_lines_into_history():
    term, _ = make(5, 4)
    term.feed("a\r\nb\r\nc\r\nd")
    term.resize(5, 2)
    assert screen(term) == ["c", "d"]
    assert history(term) == ["a", "b"]
    assert cursor(term) == (1, 1)


def test_resize_shrink_rows_drops_blank_lines_below_cursor_first():
    term, _ = make(5, 4)
    term.feed("a\r\nb")
    term.resize(5, 2)
    assert screen(term) == ["a", "b"]
    assert history(term) == []


def test_resize_grow_rows_pulls_history_back():
    term, _ = make(5, 2)
    term.feed("a\r\nb\r\nc\r\nd")
    term.resize(5, 4)
    assert screen(term) == ["a", "b", "c", "d"]
    assert cursor(term) == (1, 3)
    assert history(term) == []


def test_resize_columns_clips_and_keeps_cursor_valid():
    term, _ = make(10, 2)
    term.feed("abcdefghij")
    term.resize(4, 2)
    assert screen(term)[0] == "abcd"
    assert term.x == 3
    term.resize(8, 2)
    assert screen(term)[0] == "abcd"
    term.feed("\x1b[1;8Hz")
    assert screen(term)[0] == "abcd   z"


def test_resize_clips_wide_char_at_edge():
    term, _ = make(4, 1)
    term.feed("ab中")
    term.resize(3, 1)
    assert term.lines[0].chars == ["a", "b", " "]


def test_resize_resets_margins_and_tabs():
    term, _ = make(10, 5)
    term.feed("\x1b[2;3r")
    term.resize(20, 6)
    assert (term.top, term.bottom) == (0, 5)
    assert 16 in term.tabs


def test_resize_with_alternate_screen_active():
    term, _ = make(5, 3)
    term.feed("x\x1b[?1049hy")
    term.resize(3, 2)
    term.feed("\x1b[?1049l")
    assert screen(term)[0] == "x"
    assert term.y <= 1


def test_resize_bounds():
    term, _ = make()
    term.resize(0, 0)
    assert (term.cols, term.rows) == (2, 1)
    term.resize(5000, 5000)
    assert (term.cols, term.rows) == (1000, 500)


def test_clear_to_cursor_line():
    term, _ = make(5, 3)
    term.feed("1\r\n2\r\n3\r\n4\r\n$ ")
    term.clear_to_cursor_line()
    assert screen(term) == ["$", "", ""]
    assert cursor(term) == (2, 0)
    assert history(term) == []


def test_bell_callback():
    rings: list[int] = []
    term = Terminal(5, 1, on_bell=lambda: rings.append(1))
    term.feed("\x07")
    assert rings == [1]


def test_backspace_and_carriage_return():
    term, _ = make()
    term.feed("abc\x08\x08X\rY")
    assert screen(term)[0] == "YXc"


def test_large_output_is_fast_enough():
    import time

    term, _ = make(120, 40, scrollback=5000)
    payload = "".join(f"\x1b[3{i % 8}mline {i} " + "x" * 80 + "\x1b[0m\r\n" for i in range(3000))
    start = time.monotonic()
    term.feed(payload)
    assert time.monotonic() - start < 2.0
    assert term.primary.history > 2000


def test_ink_style_redraw():
    term, _ = make(20, 6)
    term.feed("> prompt\r\n╭────╮\r\n│ hi │\r\n╰────╯")
    term.feed("\x1b[?2026h\x1b[2K\x1b[1A\x1b[2K\x1b[1A\x1b[2K\x1b[G╭────╮\r\n│ ok │\r\n╰────╯\x1b[?2026l")
    assert screen(term)[:4] == ["> prompt", "╭────╮", "│ ok │", "╰────╯"]
