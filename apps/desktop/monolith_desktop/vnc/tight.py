import zlib
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any
from enum import IntEnum

from .pixels import expand_bits, gradient_to_rgb, palette_to_bgrx, rgb_to_bgrx
from .protocol import RfbError
from .reader import Reader

TPIXEL = 3
STREAMS = 4
MIN_COMPRESSED = 12
FILL = 0x8
JPEG = 0x9
EXPLICIT_FILTER = 0x4
STREAM_MASK = 0x3

JpegDecoder = Callable[[bytes], tuple[int, int, bytes]]


class Filter(IntEnum):
    COPY = 0
    PALETTE = 1
    GRADIENT = 2


@dataclass(frozen=True)
class TightRect:
    resets: int
    kind: str
    data: bytes
    stream: int = 0
    filter: Filter = Filter.COPY
    palette: bytes = b""
    compressed: bool = False
    length: int = 0


FILTERS = frozenset(item.value for item in Filter)


def read_compact_length(reader: Reader) -> int:
    value = 0
    for index in range(3):
        byte = reader.u8()
        if index == 2:
            return value | byte << 14
        value |= (byte & 0x7F) << (7 * index)
        if not byte & 0x80:
            return value
    return value


def encode_compact_length(value: int) -> bytes:
    out = bytearray([value & 0x7F])
    if value > 0x7F:
        out[0] |= 0x80
        out.append(value >> 7 & 0x7F)
        if value > 0x3FFF:
            out[1] |= 0x80
            out.append(value >> 14 & 0xFF)
    return bytes(out)


def row_length(filter: Filter, colours: int, width: int) -> int:
    if filter == Filter.PALETTE:
        return (width + 7) // 8 if colours == 2 else width
    return width * TPIXEL


def read_tight(reader: Reader, width: int, height: int) -> TightRect:
    control = reader.u8()
    resets = control & 0x0F
    kind = control >> 4
    if kind == FILL:
        return TightRect(resets, "fill", reader.take(TPIXEL))
    if kind == JPEG:
        return TightRect(resets, "jpeg", reader.take(read_compact_length(reader)))
    if kind & FILL:
        raise RfbError(f"unsupported tight compression {kind:#x}")
    filter = Filter.COPY
    if kind & EXPLICIT_FILTER:
        value = reader.u8()
        if value not in FILTERS:
            raise RfbError(f"unsupported tight filter {value}")
        filter = Filter(value)
    palette = b""
    colours = 0
    if filter == Filter.PALETTE:
        colours = reader.u8() + 1
        palette = reader.take(colours * TPIXEL)
    length = row_length(filter, colours, width) * height
    if length < MIN_COMPRESSED:
        return TightRect(resets, "basic", reader.take(length), kind & STREAM_MASK, filter, palette, False, length)
    data = reader.take(read_compact_length(reader))
    return TightRect(resets, "basic", data, kind & STREAM_MASK, filter, palette, True, length)


class TightDecoder:
    def __init__(self, jpeg: JpegDecoder | None = None) -> None:
        self._jpeg = jpeg
        self._streams: list[Any] = [None] * STREAMS

    def reset(self, mask: int) -> None:
        for index in range(STREAMS):
            if mask & (1 << index):
                self._streams[index] = None

    def _inflate(self, stream: int, data: bytes, length: int) -> bytes:
        decompressor = self._streams[stream]
        if decompressor is None:
            decompressor = self._streams[stream] = zlib.decompressobj()
        try:
            out = decompressor.decompress(data)
        except zlib.error as error:
            raise RfbError(f"tight zlib stream {stream}: {error}") from error
        if len(out) < length:
            raise RfbError("tight rectangle is truncated")
        return out[:length]

    def decode(self, rect: TightRect, width: int, height: int) -> tuple[bytes | None, bytes | bytearray | None]:
        self.reset(rect.resets)
        count = width * height
        if rect.kind == "fill":
            return bytes((rect.data[2], rect.data[1], rect.data[0], 0)), None
        if rect.kind == "jpeg":
            return None, self._decode_jpeg(rect.data, width, height)
        data = self._inflate(rect.stream, rect.data, rect.length) if rect.compressed else rect.data
        if rect.filter == Filter.PALETTE:
            colours = len(rect.palette) // TPIXEL
            indices = expand_bits(data, width, height) if colours == 2 else data
            return None, palette_to_bgrx(indices, rect.palette, count)
        if rect.filter == Filter.GRADIENT:
            return None, rgb_to_bgrx(gradient_to_rgb(data, width, height), count)
        return None, rgb_to_bgrx(data, count)

    def _decode_jpeg(self, data: bytes, width: int, height: int) -> bytearray:
        if self._jpeg is None:
            raise RfbError("server sent JPEG without a decoder")
        decoded_width, decoded_height, rgb = self._jpeg(data)
        if (decoded_width, decoded_height) != (width, height):
            raise RfbError("tight JPEG size does not match its rectangle")
        return rgb_to_bgrx(rgb, width * height)
