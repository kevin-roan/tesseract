from .protocol import RfbError

BYTES_PER_PIXEL = 4
RGB_BYTES = 3
MAX_PALETTE = 256
BIT_EXPAND = tuple(bytes((value >> (7 - bit)) & 1 for bit in range(8)) for value in range(256))
ALPHA_FROM_BIT = bytes([0, 255]) + bytes(254)


def rgb_to_bgrx(rgb: bytes, count: int) -> bytearray:
    rgb = bytes(rgb)
    end = count * RGB_BYTES
    if len(rgb) < end:
        raise RfbError("pixel data is truncated")
    out = bytearray(count * BYTES_PER_PIXEL)
    out[0::4] = rgb[2:end:3]
    out[1::4] = rgb[1:end:3]
    out[2::4] = rgb[0:end:3]
    return out


def expand_bits(data: bytes, width: int, height: int) -> bytes:
    stride = (width + 7) // 8
    expanded = b"".join(map(BIT_EXPAND.__getitem__, data[: stride * height]))
    if width == stride * 8:
        return expanded
    bits = stride * 8
    return b"".join(expanded[row * bits : row * bits + width] for row in range(height))


def palette_to_bgrx(indices: bytes, palette: bytes, count: int) -> bytearray:
    if len(indices) < count:
        raise RfbError("tight palette data is truncated")
    indices = bytes(indices[:count])
    red = bytes(palette[0::3]).ljust(MAX_PALETTE, b"\0")
    green = bytes(palette[1::3]).ljust(MAX_PALETTE, b"\0")
    blue = bytes(palette[2::3]).ljust(MAX_PALETTE, b"\0")
    out = bytearray(count * BYTES_PER_PIXEL)
    out[0::4] = indices.translate(blue)
    out[1::4] = indices.translate(green)
    out[2::4] = indices.translate(red)
    return out


def gradient_to_rgb(data: bytes, width: int, height: int) -> bytes:
    row = width * RGB_BYTES
    out = bytearray(row * height)
    above = bytearray(row)
    for y in range(height):
        current = bytearray(row)
        base = y * row
        for x in range(width):
            for channel in range(RGB_BYTES):
                index = x * RGB_BYTES + channel
                left = current[index - RGB_BYTES] if x else 0
                corner = above[index - RGB_BYTES] if x else 0
                predicted = min(255, max(0, left + above[index] - corner))
                current[index] = (predicted + data[base + index]) & 0xFF
        out[base : base + row] = current
        above = current
    return bytes(out)


def cursor_bgra(pixels: bytes, mask: bytes, width: int, height: int) -> bytes:
    out = bytearray(pixels[: width * height * BYTES_PER_PIXEL])
    out[3::4] = expand_bits(mask, width, height).translate(ALPHA_FROM_BIT)
    return bytes(out)
