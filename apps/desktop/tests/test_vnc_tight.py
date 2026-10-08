import struct
import zlib

import pytest

from tesseract_desktop.vnc.pixels import cursor_bgra, expand_bits, gradient_to_rgb, palette_to_bgrx, rgb_to_bgrx
from tesseract_desktop.vnc.protocol import Encoding, RfbError
from tesseract_desktop.vnc.reader import NeedMore, Reader
from tesseract_desktop.vnc.tight import encode_compact_length, read_compact_length

from test_vnc_client import connected, pixel_at, px, rect, update


def compress(stream: "zlib._Compress", data: bytes) -> bytes:
    return stream.compress(data) + stream.flush(zlib.Z_SYNC_FLUSH)


def basic(control: int, body: bytes, *, filter_id: int | None = None, palette: bytes = b"") -> bytes:
    head = bytes([control | (0x40 if filter_id is not None else 0)])
    if filter_id is not None:
        head += bytes([filter_id])
    if palette:
        head += bytes([len(palette) // 3 - 1]) + palette
    return head + body


def compressed(data: bytes) -> bytes:
    return encode_compact_length(len(data)) + data


@pytest.mark.parametrize("value", [0, 1, 127, 128, 300, 16383, 16384, 4_194_303])
def test_compact_length_roundtrip(value):
    encoded = encode_compact_length(value)
    assert len(encoded) == (1 if value < 128 else 2 if value < 16384 else 3)
    reader = Reader(bytearray(encoded), 0)
    assert read_compact_length(reader) == value
    assert reader.pos == len(encoded)


def test_compact_length_partial_needs_more():
    with pytest.raises(NeedMore):
        read_compact_length(Reader(bytearray(b"\x80"), 0))


def test_rgb_to_bgrx():
    assert rgb_to_bgrx(b"\x01\x02\x03\x04\x05\x06", 2) == bytearray(b"\x03\x02\x01\x00\x06\x05\x04\x00")
    with pytest.raises(RfbError):
        rgb_to_bgrx(b"\x01", 1)


def test_expand_bits_trims_row_padding():
    assert expand_bits(bytes([0b10100000, 0b01000000]), 3, 2) == bytes([1, 0, 1, 0, 1, 0])
    assert expand_bits(bytes([0xFF]), 8, 1) == bytes([1] * 8)


def test_palette_to_bgrx():
    palette = bytes([255, 0, 0, 0, 255, 0, 0, 0, 255])
    out = palette_to_bgrx(bytes([0, 1, 2]), palette, 3)
    assert out == bytearray(px(0, 0, 255) + px(0, 255, 0) + px(255, 0, 0))


def test_gradient_filter():
    data = bytes([10, 20, 30, 1, 1, 1, 2, 2, 2, 3, 3, 3])
    assert gradient_to_rgb(data, 2, 2) == bytes([10, 20, 30, 11, 21, 31, 12, 22, 32, 16, 26, 36])


def test_cursor_bgra_mask():
    out = cursor_bgra(px(1, 2, 3) * 3, bytes([0b10100000]), 3, 1)
    assert out[3::4] == bytes([255, 0, 255])


def test_tight_fill():
    client, _, _ = connected(4, 4)
    client.feed(update(rect(1, 1, 2, 2, Encoding.TIGHT, bytes([0x80, 1, 2, 3]))))
    assert pixel_at(client, 1, 1) == px(3, 2, 1)
    assert pixel_at(client, 2, 2) == px(3, 2, 1)
    assert pixel_at(client, 0, 0) == bytes(4)


def test_tight_copy_small_is_uncompressed():
    client, _, _ = connected(4, 4)
    client.feed(update(rect(0, 0, 2, 1, Encoding.TIGHT, basic(0x00, bytes([1, 2, 3, 4, 5, 6])))))
    assert pixel_at(client, 0, 0) == px(3, 2, 1)
    assert pixel_at(client, 1, 0) == px(6, 5, 4)


def test_tight_zlib_stream_persists_and_resets():
    client, _, _ = connected(4, 4)
    stream = zlib.compressobj()
    first = bytes(range(48))
    second = bytes(range(100, 148))
    client.feed(update(rect(0, 0, 4, 4, Encoding.TIGHT, basic(0x10, compressed(compress(stream, first))))))
    client.feed(update(rect(0, 0, 4, 4, Encoding.TIGHT, basic(0x10, compressed(compress(stream, second))))))
    assert pixel_at(client, 0, 0) == px(102, 101, 100)
    fresh = zlib.compressobj()
    client.feed(update(rect(0, 0, 4, 4, Encoding.TIGHT, basic(0x12, compressed(compress(fresh, first))))))
    assert pixel_at(client, 0, 0) == px(2, 1, 0)


def test_tight_corrupt_stream_errors():
    client, _, _ = connected(4, 4)
    with pytest.raises(RfbError):
        client.feed(update(rect(0, 0, 4, 4, Encoding.TIGHT, basic(0x00, compressed(b"not zlib data at all")))))


def test_tight_mono_palette():
    client, _, _ = connected(10, 8)
    palette = bytes([0, 0, 0, 255, 255, 255])
    bits = bytes([0b10000000, 0b01000000]) + bytes(12) + bytes([0b00000001, 0b11000000])
    body = compressed(compress(zlib.compressobj(), bits))
    client.feed(update(rect(0, 0, 10, 8, Encoding.TIGHT, basic(0x00, body, filter_id=1, palette=palette))))
    assert pixel_at(client, 0, 0) == px(255, 255, 255)
    assert pixel_at(client, 1, 0) == px(0, 0, 0)
    assert pixel_at(client, 9, 0) == px(255, 255, 255)
    assert pixel_at(client, 8, 0) == px(0, 0, 0)
    assert [pixel_at(client, x, 7)[0] for x in range(10)] == [0] * 7 + [255] * 3


def test_tight_mono_palette_uncompressed():
    client, _, _ = connected(10, 2)
    palette = bytes([0, 0, 0, 255, 255, 255])
    client.feed(update(rect(0, 0, 10, 2, Encoding.TIGHT, basic(0x00, bytes([0, 0x40, 0x80, 0]), filter_id=1, palette=palette))))
    assert pixel_at(client, 9, 0) == px(255, 255, 255)
    assert pixel_at(client, 0, 1) == px(255, 255, 255)
    assert pixel_at(client, 1, 1) == px(0, 0, 0)


def test_tight_indexed_palette_small():
    client, _, _ = connected(4, 1)
    palette = bytes([1, 2, 3, 4, 5, 6, 7, 8, 9])
    client.feed(update(rect(0, 0, 4, 1, Encoding.TIGHT, basic(0x00, bytes([2, 1, 0, 2]), filter_id=1, palette=palette))))
    assert [pixel_at(client, x, 0) for x in range(4)] == [px(9, 8, 7), px(6, 5, 4), px(3, 2, 1), px(9, 8, 7)]


def test_tight_gradient():
    client, _, _ = connected(2, 2)
    data = bytes([10, 20, 30, 1, 1, 1, 2, 2, 2, 3, 3, 3])
    client.feed(update(rect(0, 0, 2, 2, Encoding.TIGHT, basic(0x00, compressed(compress(zlib.compressobj(), data)), filter_id=2))))
    assert pixel_at(client, 1, 1) == px(36, 26, 16)


def test_tight_jpeg_uses_decoder():
    seen = []

    def decoder(data: bytes):
        seen.append(data)
        return 2, 1, bytes([1, 2, 3, 4, 5, 6])

    client, sent, _ = connected(4, 4, jpeg=decoder, jpeg_quality=6)
    client.feed(update(rect(1, 1, 2, 1, Encoding.TIGHT, bytes([0x90]) + compressed(b"JPEGDATA"))))
    assert seen == [b"JPEGDATA"]
    assert pixel_at(client, 1, 1) == px(3, 2, 1)
    assert pixel_at(client, 2, 1) == px(6, 5, 4)


def test_tight_jpeg_size_mismatch_errors():
    client, _, _ = connected(4, 4, jpeg=lambda data: (1, 1, b"\x00\x00\x00"))
    with pytest.raises(RfbError):
        client.feed(update(rect(0, 0, 2, 1, Encoding.TIGHT, bytes([0x90]) + compressed(b"x"))))


def test_tight_jpeg_without_decoder_errors():
    client, _, _ = connected(4, 4)
    with pytest.raises(RfbError):
        client.feed(update(rect(0, 0, 2, 1, Encoding.TIGHT, bytes([0x90]) + compressed(b"x"))))


def test_tight_bad_filter_and_control():
    client, _, _ = connected(4, 4)
    with pytest.raises(RfbError):
        client.feed(update(rect(0, 0, 1, 1, Encoding.TIGHT, bytes([0x40, 9]))))
    client, _, _ = connected(4, 4)
    with pytest.raises(RfbError):
        client.feed(update(rect(0, 0, 1, 1, Encoding.TIGHT, bytes([0xA0]))))


def test_quality_encoding_only_with_decoder():
    from tesseract_desktop.vnc.client import encodings_for

    assert -26 in encodings_for(6)
    assert all(not -32 <= e <= -23 for e in encodings_for(None))
    assert Encoding.CURSOR not in encodings_for(None, cursor=False)
    assert struct.calcsize(">i") == 4
