import re
import struct
from dataclasses import dataclass
from enum import IntEnum


class Encoding(IntEnum):
    RAW = 0
    COPY_RECT = 1
    TIGHT = 7
    DESKTOP_SIZE = -223
    LAST_RECT = -224
    CURSOR = -239
    EXTENDED_DESKTOP_SIZE = -308


TIGHT_QUALITY_BASE = -32
TIGHT_COMPRESS_BASE = -256


class Security(IntEnum):
    INVALID = 0
    NONE = 1
    VNC_AUTH = 2


class ServerMessage(IntEnum):
    FRAMEBUFFER_UPDATE = 0
    SET_COLOUR_MAP_ENTRIES = 1
    BELL = 2
    SERVER_CUT_TEXT = 3


class ClientMessage(IntEnum):
    SET_PIXEL_FORMAT = 0
    SET_ENCODINGS = 2
    FRAMEBUFFER_UPDATE_REQUEST = 3
    KEY_EVENT = 4
    POINTER_EVENT = 5
    CLIENT_CUT_TEXT = 6


VERSION_LENGTH = 12
VERSION_PATTERN = re.compile(rb"RFB (\d{3})\.(\d{3})\n")
CHALLENGE_LENGTH = 16
SUPPORTED_MINORS = (8, 7, 3)
PIXEL_FORMAT = struct.Struct(">BBBBHHHBBB3x")
RECT_HEADER = struct.Struct(">HHHHi")
SERVER_INIT = struct.Struct(">HH16sI")
SCREEN_LENGTH = 16
TEXT_ENCODING = "latin-1"


class RfbError(Exception):
    pass


@dataclass(frozen=True)
class PixelFormat:
    bits_per_pixel: int
    depth: int
    big_endian: bool
    true_colour: bool
    red_max: int
    green_max: int
    blue_max: int
    red_shift: int
    green_shift: int
    blue_shift: int

    @property
    def bytes_per_pixel(self) -> int:
        return self.bits_per_pixel // 8

    def pack(self) -> bytes:
        return PIXEL_FORMAT.pack(
            self.bits_per_pixel, self.depth, int(self.big_endian), int(self.true_colour),
            self.red_max, self.green_max, self.blue_max, self.red_shift, self.green_shift, self.blue_shift,
        )

    @classmethod
    def unpack(cls, data: bytes) -> "PixelFormat":
        bpp, depth, big, true_colour, rmax, gmax, bmax, rshift, gshift, bshift = PIXEL_FORMAT.unpack(bytes(data))
        return cls(bpp, depth, bool(big), bool(true_colour), rmax, gmax, bmax, rshift, gshift, bshift)


BGRX = PixelFormat(32, 24, False, True, 255, 255, 255, 16, 8, 0)


def parse_version(banner: bytes) -> tuple[int, int]:
    match = VERSION_PATTERN.fullmatch(bytes(banner))
    if match is None:
        raise RfbError(f"not an RFB server: {bytes(banner)!r}")
    return int(match.group(1)), int(match.group(2))


def negotiate_version(server: tuple[int, int]) -> tuple[int, int]:
    major, minor = server
    if major < 3:
        raise RfbError(f"unsupported RFB version {major}.{minor}")
    if major > 3:
        return 3, SUPPORTED_MINORS[0]
    for supported in SUPPORTED_MINORS:
        if minor >= supported:
            return 3, supported
    return 3, SUPPORTED_MINORS[-1]


def version_message(version: tuple[int, int]) -> bytes:
    return b"RFB %03d.%03d\n" % version


def choose_security(offered: list[int]) -> int:
    if Security.NONE in offered:
        return Security.NONE
    if Security.VNC_AUTH in offered:
        return Security.VNC_AUTH
    raise RfbError(f"no supported security type (server offers {offered})")


def set_pixel_format(fmt: PixelFormat) -> bytes:
    return struct.pack(">B3x", ClientMessage.SET_PIXEL_FORMAT) + fmt.pack()


def set_encodings(encodings: list[int]) -> bytes:
    return struct.pack(f">BxH{len(encodings)}i", ClientMessage.SET_ENCODINGS, len(encodings), *encodings)


def framebuffer_update_request(incremental: bool, x: int, y: int, width: int, height: int) -> bytes:
    return struct.pack(">BBHHHH", ClientMessage.FRAMEBUFFER_UPDATE_REQUEST, int(incremental), x, y, width, height)


def key_event(keysym: int, down: bool) -> bytes:
    return struct.pack(">BBxxI", ClientMessage.KEY_EVENT, int(down), keysym & 0xFFFFFFFF)


def pointer_event(mask: int, x: int, y: int) -> bytes:
    return struct.pack(">BBHH", ClientMessage.POINTER_EVENT, mask & 0xFF, max(0, min(0xFFFF, x)), max(0, min(0xFFFF, y)))


def encode_cut_text(text: str) -> bytes:
    return text.replace("\r\n", "\n").encode(TEXT_ENCODING, errors="replace")


def client_cut_text(text: str) -> bytes:
    payload = encode_cut_text(text)
    return struct.pack(">B3xI", ClientMessage.CLIENT_CUT_TEXT, len(payload)) + payload


def decode_text(data: bytes) -> str:
    return bytes(data).decode(TEXT_ENCODING, errors="replace")
