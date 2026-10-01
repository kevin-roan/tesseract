import gi

gi.require_version("GdkPixbuf", "2.0")
from gi.repository import GdkPixbuf  # noqa: E402

from .protocol import RfbError  # noqa: E402

RGB = 3
RGBA = 4


def decode_jpeg(data: bytes) -> tuple[int, int, bytes]:
    loader = GdkPixbuf.PixbufLoader.new_with_type("jpeg")
    try:
        loader.write(data)
        loader.close()
    except Exception as error:
        raise RfbError(f"invalid JPEG rectangle: {error}") from error
    pixbuf = loader.get_pixbuf()
    width, height = pixbuf.get_width(), pixbuf.get_height()
    stride, channels = pixbuf.get_rowstride(), pixbuf.get_n_channels()
    pixels = pixbuf.get_pixels()
    row = width * channels
    packed = pixels[: row * height] if stride == row else b"".join(pixels[y * stride : y * stride + row] for y in range(height))
    if channels == RGB:
        return width, height, bytes(packed)
    rgb = bytearray(width * height * RGB)
    for channel in range(RGB):
        rgb[channel::RGB] = packed[channel::RGBA]
    return width, height, bytes(rgb)
