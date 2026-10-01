class NeedMore(Exception):
    def __init__(self, needed: int) -> None:
        super().__init__(needed)
        self.needed = needed


class Reader:
    def __init__(self, buffer: bytearray, start: int) -> None:
        self.buffer = buffer
        self.start = start
        self.pos = start

    def require(self, count: int) -> None:
        if self.pos + count > len(self.buffer):
            raise NeedMore(self.pos + count - self.start)

    def take(self, count: int) -> bytes:
        self.require(count)
        end = self.pos + count
        data = bytes(self.buffer[self.pos : end])
        self.pos = end
        return data

    def u8(self) -> int:
        self.require(1)
        value = self.buffer[self.pos]
        self.pos += 1
        return value

    def u16(self) -> int:
        return int.from_bytes(self.take(2), "big")

    def u32(self) -> int:
        return int.from_bytes(self.take(4), "big")

    def skip(self, count: int) -> None:
        self.require(count)
        self.pos += count
