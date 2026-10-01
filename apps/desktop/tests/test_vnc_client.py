import random
import struct
import zlib

import pytest

from monolith_desktop.vnc.client import AuthenticationFailed, RfbClient, RfbEvents, encodings_for
from monolith_desktop.vnc.des import des_encrypt, vnc_auth_response, vnc_key
from monolith_desktop.vnc.framebuffer import Rect
from monolith_desktop.vnc.protocol import BGRX, Encoding, RfbError, negotiate_version, parse_version, set_pixel_format
from monolith_desktop.vnc.tight import encode_compact_length

CHALLENGE = bytes(range(16))
SERVER_FORMAT = BGRX.pack()


class Recorder(RfbEvents):
    def __init__(self) -> None:
        self.calls: list[tuple] = []

    def on_authenticating(self) -> None:
        self.calls.append(("auth",))

    def on_connected(self, name: str, width: int, height: int) -> None:
        self.calls.append(("connected", name, width, height))

    def on_resize(self, width: int, height: int) -> None:
        self.calls.append(("resize", width, height))

    def on_update(self, damage: list[Rect]) -> None:
        self.calls.append(("update", damage))

    def on_bell(self) -> None:
        self.calls.append(("bell",))

    def on_cut_text(self, text: str) -> None:
        self.calls.append(("cut", text))

    def on_cursor(self, cursor) -> None:
        self.calls.append(("cursor", cursor))


def make_client(password: str | None = "secret", jpeg=None, jpeg_quality=None):
    sent: list[bytes] = []
    events = Recorder()
    client = RfbClient(sent.append, events, password=password, jpeg=jpeg, jpeg_quality=jpeg_quality)
    return client, sent, events


def server_init(width: int, height: int, name: bytes = b"desk") -> bytes:
    return struct.pack(">HH", width, height) + SERVER_FORMAT + struct.pack(">I", len(name)) + name


def handshake_38_none(width: int = 4, height: int = 3) -> bytes:
    return b"RFB 003.008\n" + bytes([1, 1]) + struct.pack(">I", 0) + server_init(width, height)


def connected(width: int = 4, height: int = 3, **kwargs):
    client, sent, events = make_client(**kwargs)
    client.feed(handshake_38_none(width, height))
    sent.clear()
    events.calls.clear()
    return client, sent, events


def update(*rects: bytes) -> bytes:
    return struct.pack(">BxH", 0, len(rects)) + b"".join(rects)


def rect(x: int, y: int, w: int, h: int, encoding: int, payload: bytes = b"") -> bytes:
    return struct.pack(">HHHHi", x, y, w, h, encoding) + payload


def px(b: int, g: int, r: int) -> bytes:
    return bytes((b, g, r, 0))


def pixel_at(client: RfbClient, x: int, y: int) -> bytes:
    fb = client.framebuffer
    offset = y * fb.stride + x * 4
    return bytes(fb.data[offset : offset + 4])


def test_parse_and_negotiate_version():
    assert parse_version(b"RFB 003.008\n") == (3, 8)
    assert negotiate_version((3, 8)) == (3, 8)
    assert negotiate_version((3, 889)) == (3, 8)
    assert negotiate_version((3, 7)) == (3, 7)
    assert negotiate_version((3, 5)) == (3, 3)
    assert negotiate_version((4, 1)) == (3, 8)
    with pytest.raises(RfbError):
        parse_version(b"HTTP/1.1 400")
    with pytest.raises(RfbError):
        negotiate_version((2, 0))


def test_des_known_vector_and_vnc_key():
    assert des_encrypt(bytes.fromhex("0123456789abcdef"), b"Now is t").hex() == "3fa40e8a984d4815"
    assert vnc_key("\x01") == b"\x80" + bytes(7)
    assert vnc_key("abcdefghij") == vnc_key("abcdefgh")
    key = vnc_key("secret")
    assert vnc_auth_response(CHALLENGE, "secret") == des_encrypt(key, CHALLENGE[:8]) + des_encrypt(key, CHALLENGE[8:])


def test_vnc_auth_handshake_byte_by_byte():
    client, sent, events = make_client()
    stream = (
        b"RFB 003.008\n"
        + bytes([2, 2, 16])
        + CHALLENGE
        + struct.pack(">I", 0)
        + server_init(1600, 900, b"TheOne")
    )
    for byte in stream:
        client.feed(bytes([byte]))
    assert sent[0] == b"RFB 003.008\n"
    assert sent[1] == bytes([2])
    assert sent[2] == vnc_auth_response(CHALLENGE, "secret")
    assert sent[3] == b"\x01"
    assert sent[4] == set_pixel_format(BGRX)
    count = struct.unpack(">H", sent[5][2:4])[0]
    assert list(struct.unpack(f">{count}i", sent[5][4:])) == encodings_for(None)
    assert sent[6] == struct.pack(">BBHHHH", 3, 0, 0, 0, 1600, 900)
    assert events.calls == [("auth",), ("connected", "TheOne", 1600, 900)]
    assert client.ready and client.name == "TheOne"
    assert (client.framebuffer.width, client.framebuffer.height) == (1600, 900)


def test_security_none_on_37_skips_result():
    client, sent, events = make_client(password=None)
    client.feed(b"RFB 003.007\n" + bytes([1, 1]) + server_init(2, 2))
    assert sent[:3] == [b"RFB 003.007\n", b"\x01", b"\x01"]
    assert client.ready


def test_security_33_vnc_auth():
    client, sent, _ = make_client()
    client.feed(b"RFB 003.003\n" + struct.pack(">I", 2) + CHALLENGE + struct.pack(">I", 0) + server_init(2, 2))
    assert sent[0] == b"RFB 003.003\n"
    assert sent[1] == vnc_auth_response(CHALLENGE, "secret")
    assert client.ready


def test_security_33_refusal_reason():
    client, _, _ = make_client()
    with pytest.raises(RfbError, match="too many"):
        client.feed(b"RFB 003.003\n" + struct.pack(">I", 0) + struct.pack(">I", 8) + b"too many")


def test_security_types_empty_reports_reason():
    client, _, _ = make_client()
    with pytest.raises(RfbError, match="blacklisted"):
        client.feed(b"RFB 003.008\n" + b"\x00" + struct.pack(">I", 11) + b"blacklisted")


def test_auth_failure_reason_38():
    client, _, _ = make_client()
    with pytest.raises(AuthenticationFailed, match="Authentication failure"):
        client.feed(
            b"RFB 003.008\n" + bytes([1, 2]) + CHALLENGE + struct.pack(">I", 1) + struct.pack(">I", 22)
            + b"Authentication failure"
        )


def test_auth_failure_without_reason_37():
    client, _, _ = make_client()
    with pytest.raises(AuthenticationFailed):
        client.feed(b"RFB 003.007\n" + bytes([1, 2]) + CHALLENGE + struct.pack(">I", 1))


def test_missing_password_is_auth_failure():
    client, _, _ = make_client(password=None)
    with pytest.raises(AuthenticationFailed):
        client.feed(b"RFB 003.008\n" + bytes([1, 2]) + CHALLENGE)


def test_unsupported_security():
    client, _, _ = make_client()
    with pytest.raises(RfbError):
        client.feed(b"RFB 003.008\n" + bytes([1, 18]))


def test_raw_rect_and_incremental_request():
    client, sent, events = connected()
    pixels = b"".join(px(i, i + 1, i + 2) for i in range(4))
    client.feed(update(rect(1, 1, 2, 2, Encoding.RAW, pixels)))
    assert pixel_at(client, 1, 1) == px(0, 1, 2)
    assert pixel_at(client, 2, 1) == px(1, 2, 3)
    assert pixel_at(client, 1, 2) == px(2, 3, 4)
    assert pixel_at(client, 2, 2) == px(3, 4, 5)
    assert pixel_at(client, 0, 0) == bytes(4)
    assert events.calls == [("update", [Rect(1, 1, 2, 2)])]
    assert sent == [struct.pack(">BBHHHH", 3, 1, 0, 0, 4, 3)]


def test_full_width_raw_rect():
    client, _, _ = connected(2, 2)
    client.feed(update(rect(0, 0, 2, 2, Encoding.RAW, px(1, 1, 1) + px(2, 2, 2) + px(3, 3, 3) + px(4, 4, 4))))
    assert bytes(client.framebuffer.data) == px(1, 1, 1) + px(2, 2, 2) + px(3, 3, 3) + px(4, 4, 4)


def test_copy_rect_overlapping_down():
    client, _, _ = connected(1, 4)
    client.feed(update(rect(0, 0, 1, 4, Encoding.RAW, px(1, 0, 0) + px(2, 0, 0) + px(3, 0, 0) + px(4, 0, 0))))
    client.feed(update(rect(0, 1, 1, 3, Encoding.COPY_RECT, struct.pack(">HH", 0, 0))))
    assert [pixel_at(client, 0, y)[0] for y in range(4)] == [1, 1, 2, 3]


def test_copy_rect_overlapping_up():
    client, _, _ = connected(1, 4)
    client.feed(update(rect(0, 0, 1, 4, Encoding.RAW, px(1, 0, 0) + px(2, 0, 0) + px(3, 0, 0) + px(4, 0, 0))))
    client.feed(update(rect(0, 0, 1, 3, Encoding.COPY_RECT, struct.pack(">HH", 0, 1))))
    assert [pixel_at(client, 0, y)[0] for y in range(4)] == [2, 3, 4, 4]


def test_desktop_size_resizes_and_requests_full_update():
    client, sent, events = connected()
    client.feed(update(rect(0, 0, 8, 6, Encoding.DESKTOP_SIZE)))
    assert (client.framebuffer.width, client.framebuffer.height) == (8, 6)
    assert ("resize", 8, 6) in events.calls
    assert sent == [struct.pack(">BBHHHH", 3, 0, 0, 0, 8, 6)]


def test_extended_desktop_size():
    client, _, events = connected()
    screen = struct.pack(">IHHHHI", 1, 0, 0, 10, 5, 0)
    client.feed(update(rect(0, 0, 10, 5, Encoding.EXTENDED_DESKTOP_SIZE, b"\x01\x00\x00\x00" + screen)))
    assert (client.framebuffer.width, client.framebuffer.height) == (10, 5)
    client.feed(update(rect(1, 3, 20, 20, Encoding.EXTENDED_DESKTOP_SIZE, b"\x00\x00\x00\x00")))
    assert (client.framebuffer.width, client.framebuffer.height) == (10, 5)


def test_cursor_pseudo_encoding():
    client, _, events = connected()
    pixels = px(10, 20, 30) * 2 + px(1, 2, 3) * 2
    mask = bytes([0b10000000, 0b01000000])
    client.feed(update(rect(1, 0, 2, 2, Encoding.CURSOR, pixels + mask)))
    cursor = next(call[1] for call in events.calls if call[0] == "cursor")
    assert (cursor.width, cursor.height, cursor.hot_x, cursor.hot_y) == (2, 2, 1, 0)
    assert cursor.pixels[3::4] == bytes([255, 0, 0, 255])
    assert cursor.pixels[0:3] == bytes([10, 20, 30])


def test_last_rect_ends_update():
    client, sent, events = connected()
    client.feed(struct.pack(">BxH", 0, 0xFFFF) + rect(0, 0, 1, 1, Encoding.RAW, px(9, 9, 9)) + rect(0, 0, 0, 0, Encoding.LAST_RECT))
    assert client.phase == "normal"
    assert events.calls == [("update", [Rect(0, 0, 1, 1)])]
    assert len(sent) == 1


def test_empty_update_requests_again():
    client, sent, events = connected()
    client.feed(update())
    assert client.phase == "normal"
    assert len(sent) == 1
    assert events.calls == []


def test_bell_cut_text_and_colour_map():
    client, _, events = connected()
    client.feed(b"\x02" + b"\x03\x00\x00\x00" + struct.pack(">I", 5) + "héllo".encode("latin-1"))
    client.feed(b"\x01\x00" + struct.pack(">HH", 0, 2) + bytes(12) + b"\x02")
    assert events.calls == [("bell",), ("cut", "héllo"), ("bell",)]


def test_unknown_message_is_error():
    client, _, _ = connected()
    with pytest.raises(RfbError):
        client.feed(b"\x7f")


def test_out_of_bounds_rect_is_error():
    client, _, _ = connected(2, 2)
    with pytest.raises(RfbError):
        client.feed(update(rect(1, 1, 2, 2, Encoding.RAW, bytes(16))))


def test_unrequested_encoding_is_error():
    client, _, _ = connected()
    with pytest.raises(RfbError):
        client.feed(update(rect(0, 0, 1, 1, 16, bytes(4))))


def test_input_messages():
    client, sent, _ = connected(10, 10)
    client.key(0xFF0D, True)
    client.pointer(0b1001, 3, 40)
    client.cut_text("a\r\nb€")
    assert sent[0] == struct.pack(">BBxxI", 4, 1, 0xFF0D)
    assert sent[1] == struct.pack(">BBHH", 5, 9, 3, 9)
    assert sent[2] == struct.pack(">B3xI", 6, 4) + b"a\nb?"


def test_input_ignored_before_ready():
    client, sent, _ = make_client()
    client.key(0x61, True)
    client.pointer(1, 0, 0)
    assert sent == []


def _tight_session_stream(width: int, height: int) -> bytes:
    raw_rgb = bytes(random.Random(1).randrange(256) for _ in range(width * height * 3))
    compressor = zlib.compressobj()
    data = compressor.compress(raw_rgb) + compressor.flush(zlib.Z_SYNC_FLUSH)
    tight_copy = bytes([0x00]) + encode_compact_length(len(data)) + data
    fill = bytes([0x80, 10, 20, 30])
    raw = rect(0, 0, width, 1, Encoding.RAW, bytes(range(width * 4)))
    return (
        update(rect(0, 0, width, height, Encoding.TIGHT, tight_copy), raw, rect(1, 1, 2, 2, Encoding.TIGHT, fill))
        + b"\x02"
        + update(rect(0, 1, width, height - 1, Encoding.COPY_RECT, struct.pack(">HH", 0, 0)))
    )


def test_chunked_feed_matches_single_feed():
    stream = _tight_session_stream(33, 17)
    whole, _, whole_events = connected(33, 17)
    whole.feed(stream)
    rng = random.Random(7)
    for _ in range(5):
        chunked, _, chunked_events = connected(33, 17)
        pos = 0
        while pos < len(stream):
            size = rng.randint(1, 97)
            chunked.feed(stream[pos : pos + size])
            pos += size
        assert chunked.framebuffer.data == whole.framebuffer.data
        assert chunked_events.calls == whole_events.calls
    assert pixel_at(whole, 1, 2) == px(30, 20, 10)
    assert [call[0] for call in whole_events.calls] == ["update", "bell", "update"]
