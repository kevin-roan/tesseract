from dataclasses import dataclass

from .pixels import BYTES_PER_PIXEL


@dataclass(frozen=True)
class Rect:
    x: int
    y: int
    width: int
    height: int

    @property
    def empty(self) -> bool:
        return self.width <= 0 or self.height <= 0


def union(rects: list[Rect]) -> Rect | None:
    rects = [rect for rect in rects if not rect.empty]
    if not rects:
        return None
    left = min(rect.x for rect in rects)
    top = min(rect.y for rect in rects)
    right = max(rect.x + rect.width for rect in rects)
    bottom = max(rect.y + rect.height for rect in rects)
    return Rect(left, top, right - left, bottom - top)


class Framebuffer:
    def __init__(self, width: int = 0, height: int = 0) -> None:
        self.width = 0
        self.height = 0
        self.data = bytearray()
        self.resize(width, height)

    @property
    def stride(self) -> int:
        return self.width * BYTES_PER_PIXEL

    def resize(self, width: int, height: int) -> None:
        self.width = max(0, width)
        self.height = max(0, height)
        self.data = bytearray(self.width * self.height * BYTES_PER_PIXEL)

    def contains(self, x: int, y: int, width: int, height: int) -> bool:
        return x >= 0 and y >= 0 and width >= 0 and height >= 0 and x + width <= self.width and y + height <= self.height

    def put(self, x: int, y: int, width: int, height: int, pixels: bytes | bytearray | memoryview) -> None:
        row = width * BYTES_PER_PIXEL
        if not row or not height:
            return
        stride = self.stride
        start = y * stride + x * BYTES_PER_PIXEL
        if x == 0 and width == self.width:
            self.data[start : start + row * height] = pixels[: row * height]
            return
        data = self.data
        for line in range(height):
            offset = start + line * stride
            source = line * row
            data[offset : offset + row] = pixels[source : source + row]

    def fill(self, x: int, y: int, width: int, height: int, pixel: bytes) -> None:
        if not width or not height:
            return
        row = bytes(pixel) * width
        stride = self.stride
        start = y * stride + x * BYTES_PER_PIXEL
        if x == 0 and width == self.width:
            self.data[start : start + len(row) * height] = row * height
            return
        data = self.data
        for line in range(height):
            offset = start + line * stride
            data[offset : offset + len(row)] = row

    def copy(self, src_x: int, src_y: int, x: int, y: int, width: int, height: int) -> None:
        row = width * BYTES_PER_PIXEL
        if not row or not height:
            return
        stride = self.stride
        data = self.data
        lines = range(height - 1, -1, -1) if y > src_y else range(height)
        for line in lines:
            source = (src_y + line) * stride + src_x * BYTES_PER_PIXEL
            target = (y + line) * stride + x * BYTES_PER_PIXEL
            data[target : target + row] = data[source : source + row]

    def region(self, x: int, y: int, width: int, height: int) -> bytes:
        stride = self.stride
        return b"".join(
            bytes(self.data[(y + line) * stride + x * BYTES_PER_PIXEL : (y + line) * stride + (x + width) * BYTES_PER_PIXEL])
            for line in range(height)
        )

