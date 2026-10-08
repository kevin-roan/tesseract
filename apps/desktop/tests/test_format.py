from tesseract_desktop.util.format import (
    capitalize,
    elapsed_seconds,
    format_bytes,
    format_duration,
    format_percent,
    format_relative_time,
    format_tokens,
    format_uptime,
    join_meta,
    pluralize,
    ratio,
    split_bytes,
)
from tesseract_desktop.util.text import clean_log_text, initials_of, log_line_kind

NOW = 1_800_000_000.0


def iso(offset: float) -> str:
    from datetime import datetime, timezone

    return datetime.fromtimestamp(NOW - offset, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def test_bytes():
    assert format_bytes(0) == "0 B"
    assert format_bytes(512) == "512 B"
    assert format_bytes(1536) == "1.5 KB"
    assert format_bytes(1024 * 1024) == "1 MB"
    assert format_bytes(150 * 1024**3) == "150 GB"
    assert split_bytes(6_952_181_760) == ("6.5", "GB")
    assert format_bytes(float("nan")) == "0 B"


def test_uptime_and_duration():
    assert format_uptime(42) == "42s"
    assert format_uptime(3 * 60 + 5) == "3m"
    assert format_uptime(2 * 3600) == "2h"
    assert format_uptime(2 * 3600 + 5 * 60) == "2h 5m"
    assert format_uptime(3 * 86400 + 4 * 3600) == "3d 4h"
    assert format_duration(65) == "1m 5s"
    assert format_duration(120) == "2m"
    assert format_duration(3700) == "1h 1m"


def test_relative_time():
    assert format_relative_time(iso(10), NOW) == "just now"
    assert format_relative_time(iso(45), NOW) == "1m ago"
    assert format_relative_time(iso(2 * 3600), NOW) == "2h ago"
    assert format_relative_time(iso(3 * 86400), NOW) == "3d ago"
    assert format_relative_time(iso(30 * 86400), NOW).count("-") == 2
    assert format_relative_time("garbage", NOW) == ""


def test_elapsed():
    assert elapsed_seconds(iso(90), None, NOW) == 90
    assert elapsed_seconds(None, None, NOW) is None
    assert elapsed_seconds(iso(90), iso(30), NOW) == 60


def test_misc():
    assert format_percent(0.426) == "43%"
    assert format_percent(2) == "100%"
    assert ratio(5, 10) == 0.5
    assert ratio(5, 0) is None
    assert format_tokens(None) is None
    assert format_tokens(1) == "1 token"
    assert format_tokens(842) == "842 tokens"
    assert format_tokens(12_345) == "12.3k tokens"
    assert format_tokens(999_999) == "1M tokens"
    assert format_tokens(1_234_567) == "1.2M tokens"
    assert capitalize("electron-linux") == "Electron linux"
    assert pluralize(1, "session") == "1 session"
    assert pluralize(2, "session") == "2 sessions"
    assert join_meta("a", None, "", "b") == "a · b"


def test_text_helpers():
    assert clean_log_text("\x1b[31mred\x1b[0m\r\n") == "red"
    assert clean_log_text("progress 10%\rprogress 90%") == "progress 90%"
    assert initials_of("Ada Lovelace") == "AL"
    assert initials_of("  tesseract  ") == "T"
    assert initials_of("") == ""


def test_stderr_is_muted_unless_it_reads_as_an_error():
    assert log_line_kind("stderr", '[1.73ms] ".env"') == "stderr"
    assert log_line_kind("stderr", "Resolving dependencies") == "stderr"
    assert log_line_kind("stderr", "1 error") == "stderr"
    assert log_line_kind("stderr", 'error: Could not resolve "x"') == "error"
    assert log_line_kind("stderr", "TypeError: x is not a function") == "error"
    assert log_line_kind("stderr", "src/a.ts(3,1): error TS2304: Cannot find name") == "error"
    assert log_line_kind("stdout", "error: not on stderr") == "stdout"
    assert log_line_kind("system", "exited") == "system"
