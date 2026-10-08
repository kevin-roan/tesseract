from tesseract_desktop.widgets.terminal.parser import Parser, int_params, parse_params


class Recorder:
    def __init__(self) -> None:
        self.events: list[tuple] = []

    def print(self, text: str) -> None:
        if self.events and self.events[-1][0] == "print":
            self.events[-1] = ("print", self.events[-1][1] + text)
        else:
            self.events.append(("print", text))

    def execute(self, control: str) -> None:
        self.events.append(("exec", control))

    def esc_dispatch(self, intermediates: str, final: str) -> None:
        self.events.append(("esc", intermediates, final))

    def csi_dispatch(self, private: str, params: str, intermediates: str, final: str) -> None:
        self.events.append(("csi", private, params, intermediates, final))

    def osc_dispatch(self, data: str, terminator: str) -> None:
        self.events.append(("osc", data, terminator))


def parse(*chunks: str) -> list[tuple]:
    recorder = Recorder()
    parser = Parser(recorder)
    for chunk in chunks:
        parser.feed(chunk)
    return recorder.events


def test_plain_text_and_controls():
    assert parse("ab\r\ncd") == [("print", "ab"), ("exec", "\r"), ("exec", "\n"), ("print", "cd")]


def test_del_is_ignored_in_ground():
    assert parse("a\x7fb") == [("print", "ab")]


def test_csi_with_params_and_private_marker():
    assert parse("\x1b[?1049h\x1b[38;2;1;2;3m") == [
        ("csi", "?", "1049", "", "h"),
        ("csi", "", "38;2;1;2;3", "", "m"),
    ]


def test_csi_split_across_chunks():
    assert parse("\x1b", "[", "3", "1;", "4", "m", "x") == [("csi", "", "31;4", "", "m"), ("print", "x")]


def test_csi_with_intermediate():
    assert parse("\x1b[2 q\x1b[!p\x1b[?25$p") == [
        ("csi", "", "2", " ", "q"),
        ("csi", "", "", "!", "p"),
        ("csi", "?", "25", "$", "p"),
    ]


def test_control_inside_csi_is_executed():
    assert parse("\x1b[1\n2H") == [("exec", "\n"), ("csi", "", "12", "", "H")]


def test_invalid_csi_is_ignored_until_final():
    assert parse("\x1b[1?2Hok") == [("print", "ok")]


def test_can_aborts_sequence():
    assert parse("\x1b[12\x18x") == [("print", "x")]


def test_esc_sequences():
    assert parse("\x1b7\x1b(0\x1b#8\x1bM") == [("esc", "", "7"), ("esc", "(", "0"), ("esc", "#", "8"), ("esc", "", "M")]


def test_osc_with_bel_and_st():
    assert parse("\x1b]0;title\x07\x1b]2;other\x1b\\") == [("osc", "0;title", "\x07"), ("osc", "2;other", "\x1b\\")]


def test_osc_split_across_chunks():
    assert parse("\x1b]0;ti", "tle", "\x1b", "\\after") == [("osc", "0;title", "\x1b\\"), ("print", "after")]


def test_osc_hyperlink_passes_text_through():
    events = parse("\x1b]8;;https://example.com\x1b\\link\x1b]8;;\x1b\\")
    assert events[1] == ("print", "link")


def test_dcs_and_apc_are_swallowed():
    assert parse("a\x1bP1$r0m\x1b\\b\x1b_payload\x1b\\c") == [("print", "abc")]


def test_esc_inside_osc_starts_new_sequence():
    assert parse("\x1b]0;x\x1b[1m") == [("csi", "", "1", "", "m")]


def test_oversized_osc_is_dropped():
    events = parse("\x1b]52;c;" + "A" * 70000 + "\x07ok")
    assert events == [("print", "ok")]


def test_param_helpers():
    assert int_params("") == []
    assert int_params("1;;3") == [1, 0, 3]
    assert int_params("4:3;99999") == [4, 65535]
    assert parse_params("38:2::10:20:30;1") == [[38, 2, None, 10, 20, 30], [1]]
