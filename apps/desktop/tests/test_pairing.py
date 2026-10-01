from urllib.parse import quote

import pytest

from monolith_desktop.pairing import (
    BaseUrlError,
    PairingError,
    PairingPayload,
    build_pairing_link,
    normalize_base_url,
    parse_base_url,
    parse_pairing_link,
    qr_matrix,
    qr_rgba,
    to_websocket_url,
)

TOKEN = "q3Jx0mZ8yWv1_bT7-kLp2sR4nC6dE9fG0hI1jK2lM3n"


def test_round_trip_with_name():
    link = build_pairing_link("https://theone-sandbox.tail1234.ts.net/", TOKEN, "Home rig & co")
    assert link == (
        f"theone://pair?url={quote('https://theone-sandbox.tail1234.ts.net', safe='')}"
        f"&token={TOKEN}&name=Home%20rig%20%26%20co"
    )
    assert parse_pairing_link(link) == PairingPayload("https://theone-sandbox.tail1234.ts.net", TOKEN, "Home rig & co")


def test_round_trip_without_name_omits_key():
    link = build_pairing_link("http://127.0.0.1:7700", TOKEN)
    assert "name=" not in link
    assert parse_pairing_link(link) == PairingPayload("http://127.0.0.1:7700", TOKEN)


def test_matches_controller_output_byte_for_byte():
    link = build_pairing_link("https://theone-sandbox.tail511d9d.ts.net", "abc-_~.XYZ", "theone-sandbox")
    assert link == "theone://pair?url=https%3A%2F%2Ftheone-sandbox.tail511d9d.ts.net&token=abc-_~.XYZ&name=theone-sandbox"


def test_encode_uri_component_reserved_set():
    link = build_pairing_link("http://h:1", TOKEN, "a!b*c'd(e)f g/h?i#j")
    assert link.endswith("&name=a!b*c'd(e)f%20g%2Fh%3Fi%23j")


def test_tolerates_whitespace_case_and_triple_slash():
    link = build_pairing_link("http://100.64.0.7:7700", TOKEN, "rig")
    messy = f"  \n{link[:20]}\r\n {link[20:].replace('theone', 'THEONE')}\t \n"
    assert parse_pairing_link(messy) == PairingPayload("http://100.64.0.7:7700", TOKEN, "rig")
    assert parse_pairing_link(link.replace("theone://pair", "TheOne:///pair/")).token == TOKEN


def test_normalizes_embedded_url():
    link = f"theone://pair?url={quote('HTTPS://Sandbox.Example.ts.net:443/v1/health?x=1', safe='')}&token={TOKEN}"
    assert parse_pairing_link(link).url == "https://sandbox.example.ts.net"


@pytest.mark.parametrize(
    ("text", "code"),
    [
        ("", "empty"),
        ("   \n", "empty"),
        (f"https://example.com/pair?url=x&token={TOKEN}", "invalid_scheme"),
        (f"theone://connect?url=x&token={TOKEN}", "invalid_action"),
        (f"theone://pair?token={TOKEN}", "missing_url"),
        (f"theone://pair?url=ftp%3A%2F%2Fhost&token={TOKEN}", "invalid_url"),
        (f"theone://pair?url=%E0%A4%A&token={TOKEN}", "missing_url"),
        ("theone://pair?url=http%3A%2F%2Fhost%3A7700", "missing_token"),
        ("theone://pair?url=http%3A%2F%2Fhost%3A7700&token=", "missing_token"),
        ("theone://pair?url=http%3A%2F%2Fhost%3A7700&token=%E2%9C%93", "invalid_token"),
    ],
)
def test_rejects(text, code):
    with pytest.raises(PairingError) as info:
        parse_pairing_link(text)
    assert info.value.code == code
    assert str(info.value)


def test_build_rejects_unusable_input():
    with pytest.raises(PairingError):
        build_pairing_link("sandbox:7700", TOKEN)
    with pytest.raises(PairingError):
        build_pairing_link("http://sandbox:7700", "has space")


def test_long_names_are_capped():
    link = build_pairing_link("http://h:1", TOKEN, "x" * 200)
    assert len(parse_pairing_link(link).name) == 64


def test_first_param_wins():
    link = f"theone://pair?url=http%3A%2F%2Fa&url=http%3A%2F%2Fb&token={TOKEN}&token=zzz"
    assert parse_pairing_link(link) == PairingPayload("http://a", TOKEN)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("https://theone-sandbox.tail1234.ts.net/", "https://theone-sandbox.tail1234.ts.net"),
        ("  http://127.0.0.1:7700//  ", "http://127.0.0.1:7700"),
        ("http://localhost:80/", "http://localhost"),
        ("https://host:8443/v1/health?x=1#frag", "https://host:8443"),
        ("https://host/ui/vnc#ticket=abc", "https://host"),
        ("https://host/proxy/theone/v1", "https://host/proxy/theone"),
        ("https://host/videos", "https://host/videos"),
        ("http://[::1]:7700/", "http://[::1]:7700"),
        ("http://sandbox:07700", "http://sandbox:7700"),
        ("http://sandbox:", "http://sandbox"),
        ("HTTP://Theone-Sandbox.", "http://theone-sandbox"),
    ],
)
def test_normalizes_base_urls(value, expected):
    assert normalize_base_url(value) == expected


@pytest.mark.parametrize(
    ("value", "code"),
    [
        ("", "empty"),
        ("sandbox:7700", "unsupported_scheme"),
        ("100.64.0.1:7700", "unsupported_scheme"),
        ("ws://host", "unsupported_scheme"),
        ("https://user:pass@host", "credentials_not_allowed"),
        ("https://", "invalid_host"),
        ("https://bad host", "invalid_host"),
        ("https://host:99999", "invalid_port"),
        ("https://host:abc", "invalid_port"),
        ("https://host\n", None),
    ],
)
def test_rejects_base_urls(value, code):
    if code is None:
        assert normalize_base_url(value) == "https://host"
        return
    with pytest.raises(BaseUrlError) as info:
        parse_base_url(value)
    assert info.value.code == code
    assert normalize_base_url(value) is None


def test_to_websocket_url():
    assert to_websocket_url("https://host/prefix") == "wss://host/prefix"
    assert to_websocket_url("http://127.0.0.1:7700") == "ws://127.0.0.1:7700"


def test_qr_matrix_and_pixels():
    link = build_pairing_link("http://127.0.0.1:7700", TOKEN, "rig")
    matrix = qr_matrix(link, border=0)
    assert len(matrix) == len(matrix[0]) >= 21
    data, size = qr_rgba(link, "#261D53", "#ffffff", scale=2, border=0)
    assert size == len(matrix) * 2
    assert len(data) == size * size * 4
    assert data[:4] == bytes.fromhex("261D53ff")
