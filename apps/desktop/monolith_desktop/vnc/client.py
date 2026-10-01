from collections.abc import Callable
from dataclasses import dataclass

from .des import vnc_auth_response
from .framebuffer import Framebuffer, Rect
from .pixels import cursor_bgra
from .protocol import (
    BGRX,
    CHALLENGE_LENGTH,
    RECT_HEADER,
    SCREEN_LENGTH,
    SERVER_INIT,
    TIGHT_COMPRESS_BASE,
    TIGHT_QUALITY_BASE,
    VERSION_LENGTH,
    Encoding,
    PixelFormat,
    RfbError,
    Security,
    ServerMessage,
    choose_security,
    client_cut_text,
    decode_text,
    framebuffer_update_request,
    key_event,
    negotiate_version,
    parse_version,
    pointer_event,
    set_encodings,
    set_pixel_format,
    version_message,
)
from .reader import NeedMore, Reader
from .tight import JpegDecoder, TightDecoder, read_tight

SECURITY_OK = 0
MAX_TEXT = 16 * 1024 * 1024
TIGHT_COMPRESS_LEVEL = 1
EXTENDED_RESIZE_REPLY = 1
BASE_ENCODINGS = (
    Encoding.TIGHT,
    Encoding.COPY_RECT,
    Encoding.RAW,
    TIGHT_COMPRESS_BASE + TIGHT_COMPRESS_LEVEL,
    Encoding.EXTENDED_DESKTOP_SIZE,
    Encoding.DESKTOP_SIZE,
    Encoding.LAST_RECT,
    Encoding.CURSOR,
)


class AuthenticationFailed(RfbError):
    pass


@dataclass(frozen=True)
class CursorImage:
    width: int
    height: int
    hot_x: int
    hot_y: int
    pixels: bytes

    @property
    def empty(self) -> bool:
        return not self.width or not self.height


class RfbEvents:
    def on_authenticating(self) -> None:
        pass

    def on_connected(self, name: str, width: int, height: int) -> None:
        pass

    def on_resize(self, width: int, height: int) -> None:
        pass

    def on_update(self, damage: list[Rect]) -> None:
        pass

    def on_bell(self) -> None:
        pass

    def on_cut_text(self, text: str) -> None:
        pass

    def on_cursor(self, cursor: CursorImage) -> None:
        pass


def encodings_for(jpeg_quality: int | None, cursor: bool = True) -> list[int]:
    encodings = [int(encoding) for encoding in BASE_ENCODINGS if cursor or encoding != Encoding.CURSOR]
    if jpeg_quality is not None:
        encodings.append(TIGHT_QUALITY_BASE + max(0, min(9, jpeg_quality)))
    return encodings


class RfbClient:
    def __init__(
        self,
        send: Callable[[bytes], None],
        events: RfbEvents | None = None,
        password: str | None = None,
        jpeg: JpegDecoder | None = None,
        jpeg_quality: int | None = None,
        cursor: bool = True,
        shared: bool = True,
    ) -> None:
        self._send = send
        self._events = events or RfbEvents()
        self._password = password
        self._tight = TightDecoder(jpeg)
        self._encodings = encodings_for(jpeg_quality if jpeg else None, cursor)
        self._shared = shared
        self._buffer = bytearray()
        self._pos = 0
        self._need = 0
        self._rects_left = 0
        self._damage: list[Rect] = []
        self._full_refresh = False
        self.phase = "version"
        self.version: tuple[int, int] | None = None
        self.server_version: tuple[int, int] | None = None
        self.security: int | None = None
        self.server_format: PixelFormat | None = None
        self.name = ""
        self.framebuffer = Framebuffer()

    @property
    def ready(self) -> bool:
        return self.phase in ("normal", "rects")

    def feed(self, data: bytes) -> None:
        self._buffer += data
        if len(self._buffer) - self._pos < self._need:
            return
        try:
            while self._pos < len(self._buffer) or self.phase == "rects" and not self._rects_left:
                reader = Reader(self._buffer, self._pos)
                try:
                    self._step(reader)
                except NeedMore as more:
                    self._need = more.needed
                    break
                self._pos = reader.pos
                self._need = 0
        finally:
            if self._pos:
                del self._buffer[: self._pos]
                self._pos = 0

    def request_update(self, incremental: bool = True) -> None:
        fb = self.framebuffer
        self._send(framebuffer_update_request(incremental, 0, 0, fb.width, fb.height))

    def key(self, keysym: int, down: bool) -> None:
        if self.ready:
            self._send(key_event(keysym, down))

    def pointer(self, mask: int, x: int, y: int) -> None:
        if self.ready:
            fb = self.framebuffer
            self._send(pointer_event(mask, min(max(0, x), max(0, fb.width - 1)), min(max(0, y), max(0, fb.height - 1))))

    def cut_text(self, text: str) -> None:
        if self.ready:
            self._send(client_cut_text(text))

    def _step(self, reader: Reader) -> None:
        getattr(self, f"_on_{self.phase}")(reader)

    def _on_version(self, reader: Reader) -> None:
        self.server_version = parse_version(reader.take(VERSION_LENGTH))
        self.version = negotiate_version(self.server_version)
        self._send(version_message(self.version))
        self.phase = "security" if self.version[1] >= 7 else "security33"

    def _on_security(self, reader: Reader) -> None:
        count = reader.u8()
        if count == 0:
            raise RfbError(self._read_reason(reader) or "server refused the connection")
        chosen = choose_security(list(reader.take(count)))
        self._send(bytes([chosen]))
        self._begin_security(chosen)

    def _on_security33(self, reader: Reader) -> None:
        chosen = reader.u32()
        if chosen == Security.INVALID:
            raise RfbError(self._read_reason(reader) or "server refused the connection")
        if chosen not in (Security.NONE, Security.VNC_AUTH):
            raise RfbError(f"unsupported security type {chosen}")
        self._begin_security(chosen)

    def _begin_security(self, chosen: int) -> None:
        self.security = chosen
        if chosen == Security.VNC_AUTH:
            self.phase = "challenge"
            self._events.on_authenticating()
        elif self._sends_result():
            self.phase = "result"
        else:
            self._client_init()

    def _sends_result(self) -> bool:
        return self.security == Security.VNC_AUTH or bool(self.version and self.version[1] >= 8)

    def _on_challenge(self, reader: Reader) -> None:
        challenge = reader.take(CHALLENGE_LENGTH)
        if not self._password:
            raise AuthenticationFailed("the server needs a VNC password")
        self._send(vnc_auth_response(challenge, self._password))
        self.phase = "result"

    def _on_result(self, reader: Reader) -> None:
        result = reader.u32()
        if result == SECURITY_OK:
            self._client_init()
            return
        reason = self._read_reason(reader) if self.version and self.version[1] >= 8 else ""
        raise AuthenticationFailed(reason or "authentication failed")

    def _read_reason(self, reader: Reader) -> str:
        length = reader.u32()
        if length > MAX_TEXT:
            raise RfbError("server reason is too long")
        return decode_text(reader.take(length))

    def _client_init(self) -> None:
        self._send(bytes([int(self._shared)]))
        self.phase = "init"

    def _on_init(self, reader: Reader) -> None:
        width, height, fmt, name_length = SERVER_INIT.unpack(reader.take(SERVER_INIT.size))
        if name_length > MAX_TEXT:
            raise RfbError("desktop name is too long")
        self.name = decode_text(reader.take(name_length))
        self.server_format = PixelFormat.unpack(fmt)
        self.framebuffer.resize(width, height)
        self.phase = "normal"
        self._send(set_pixel_format(BGRX))
        self._send(set_encodings(self._encodings))
        self.request_update(incremental=False)
        self._events.on_connected(self.name, width, height)

    def _on_normal(self, reader: Reader) -> None:
        kind = reader.u8()
        if kind == ServerMessage.FRAMEBUFFER_UPDATE:
            reader.skip(1)
            self._rects_left = reader.u16()
            self._damage = []
            self.phase = "rects"
        elif kind == ServerMessage.SET_COLOUR_MAP_ENTRIES:
            reader.skip(3)
            reader.skip(reader.u16() * 6)
        elif kind == ServerMessage.BELL:
            self._events.on_bell()
        elif kind == ServerMessage.SERVER_CUT_TEXT:
            reader.skip(3)
            length = reader.u32()
            if length > MAX_TEXT:
                raise RfbError("clipboard text is too long")
            self._events.on_cut_text(decode_text(reader.take(length)))
        else:
            raise RfbError(f"unexpected server message {kind}")

    def _on_rects(self, reader: Reader) -> None:
        if not self._rects_left:
            self._finish_update()
            return
        x, y, width, height, encoding = RECT_HEADER.unpack(reader.take(RECT_HEADER.size))
        if encoding == Encoding.LAST_RECT:
            self._finish_update()
            return
        self._decode_rect(reader, x, y, width, height, encoding)
        self._rects_left -= 1

    def _decode_rect(self, reader: Reader, x: int, y: int, width: int, height: int, encoding: int) -> None:
        fb = self.framebuffer
        if encoding == Encoding.DESKTOP_SIZE:
            self._resize(width, height)
            return
        if encoding == Encoding.EXTENDED_DESKTOP_SIZE:
            screens = reader.u8()
            reader.skip(3 + screens * SCREEN_LENGTH)
            if not (x == EXTENDED_RESIZE_REPLY and y != 0):
                self._resize(width, height)
            return
        if encoding == Encoding.CURSOR:
            pixels = reader.take(width * height * BGRX.bytes_per_pixel)
            mask = reader.take((width + 7) // 8 * height)
            self._events.on_cursor(CursorImage(width, height, x, y, cursor_bgra(pixels, mask, width, height)))
            return
        if encoding not in (Encoding.RAW, Encoding.COPY_RECT, Encoding.TIGHT):
            raise RfbError(f"server used an encoding we did not ask for ({encoding})")
        if not fb.contains(x, y, width, height):
            raise RfbError(f"rectangle {width}x{height}+{x}+{y} is outside the {fb.width}x{fb.height} framebuffer")
        if encoding == Encoding.RAW:
            fb.put(x, y, width, height, reader.take(width * height * BGRX.bytes_per_pixel))
        elif encoding == Encoding.COPY_RECT:
            src_x, src_y = reader.u16(), reader.u16()
            if not fb.contains(src_x, src_y, width, height):
                raise RfbError("copy source is outside the framebuffer")
            fb.copy(src_x, src_y, x, y, width, height)
        else:
            fill, pixels = self._tight.decode(read_tight(reader, width, height), width, height)
            if fill is not None:
                fb.fill(x, y, width, height, fill)
            elif pixels is not None:
                fb.put(x, y, width, height, pixels)
        self._damage.append(Rect(x, y, width, height))

    def _resize(self, width: int, height: int) -> None:
        if width <= 0 or height <= 0:
            return
        if (width, height) != (self.framebuffer.width, self.framebuffer.height):
            self.framebuffer.resize(width, height)
            self._full_refresh = True
            self._events.on_resize(width, height)
        self._damage.append(Rect(0, 0, width, height))

    def _finish_update(self) -> None:
        self.phase = "normal"
        damage, self._damage = self._damage, []
        self.request_update(incremental=not self._full_refresh)
        self._full_refresh = False
        if damage:
            self._events.on_update(damage)
