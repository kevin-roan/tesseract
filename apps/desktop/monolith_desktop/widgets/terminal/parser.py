import re
from typing import Protocol

ESC = "\x1b"
BEL = "\x07"
CAN = "\x18"
SUB = "\x1a"
DEL = "\x7f"

MAX_PARAMS_LENGTH = 256
MAX_STRING_LENGTH = 1 << 16

GROUND = 0
ESCAPE = 1
ESCAPE_INTERMEDIATE = 2
CSI = 3
CSI_IGNORE = 4
OSC = 5
STRING = 6
STRING_ESCAPE = 7

_CONTROL = re.compile(r"[\x00-\x1f\x7f]")
_CSI_FAST = re.compile(r"\[([<=>?]?)([0-9:;]*)([ -/]*)([@-~])")
_OSC_END = re.compile(r"[\x07\x18\x1a\x1b]")
_STRING_END = re.compile(r"[\x18\x1a\x1b]")


class Handler(Protocol):
    def print(self, text: str) -> None: ...

    def execute(self, control: str) -> None: ...

    def esc_dispatch(self, intermediates: str, final: str) -> None: ...

    def csi_dispatch(self, private: str, params: str, intermediates: str, final: str) -> None: ...

    def osc_dispatch(self, data: str, terminator: str) -> None: ...


def parse_params(params: str) -> list[list[int | None]]:
    if not params:
        return []
    result: list[list[int | None]] = []
    for part in params.split(";")[:32]:
        result.append([min(int(sub), 65535) if sub.isdigit() else None for sub in part.split(":")])
    return result


def int_params(params: str) -> list[int]:
    if not params:
        return []
    values: list[int] = []
    for part in params.split(";")[:32]:
        head = part.split(":", 1)[0]
        values.append(min(int(head), 65535) if head.isdigit() else 0)
    return values


class Parser:
    def __init__(self, handler: Handler) -> None:
        self.handler = handler
        self.reset()

    def reset(self) -> None:
        self.state = GROUND
        self._private = ""
        self._params: list[str] = []
        self._intermediates = ""
        self._string: list[str] = []
        self._string_size = 0
        self._string_kind = ""

    def feed(self, data: str) -> None:
        handler = self.handler
        index = 0
        size = len(data)
        while index < size:
            state = self.state
            if state == GROUND:
                match = _CONTROL.search(data, index)
                end = match.start() if match else size
                if end > index:
                    handler.print(data[index:end])
                if match is None:
                    return
                char = data[end]
                index = end + 1
                if char == ESC:
                    fast = _CSI_FAST.match(data, index)
                    if fast is not None:
                        private, params, intermediates, final = fast.groups()
                        index = fast.end()
                        if len(params) <= MAX_PARAMS_LENGTH:
                            handler.csi_dispatch(private, params, intermediates, final)
                        continue
                    self._enter_escape()
                elif char != DEL:
                    handler.execute(char)
                continue
            if state == OSC:
                index = self._consume_string(data, index, _OSC_END)
                continue
            if state == STRING:
                index = self._consume_string(data, index, _STRING_END)
                continue
            char = data[index]
            index += 1
            self._step(char)

    def _enter_escape(self) -> None:
        self.state = ESCAPE
        self._private = ""
        self._params = []
        self._intermediates = ""

    def _consume_string(self, data: str, index: int, terminators: re.Pattern) -> int:
        match = terminators.search(data, index)
        end = match.start() if match else len(data)
        if self.state == OSC and end > index and self._string_size < MAX_STRING_LENGTH:
            chunk = data[index:end]
            self._string.append(chunk)
            self._string_size += len(chunk)
        if match is None:
            return len(data)
        char = data[end]
        if char == BEL:
            self._finish_string(BEL)
            self.state = GROUND
        elif char == ESC:
            self.state = STRING_ESCAPE
        else:
            self._string = []
            self._string_size = 0
            self.state = GROUND
        return end + 1

    def _finish_string(self, terminator: str) -> None:
        if self._string_kind == "]" and self._string_size <= MAX_STRING_LENGTH:
            self.handler.osc_dispatch("".join(self._string), terminator)
        self._string = []
        self._string_size = 0

    def _step(self, char: str) -> None:
        state = self.state
        code = ord(char)
        if char in (CAN, SUB):
            self.state = GROUND
            return
        if state == STRING_ESCAPE:
            if char == "\\":
                self._finish_string(ESC + "\\")
                self.state = GROUND
                return
            self._string = []
            self._string_size = 0
            self._enter_escape()
            self._step(char)
            return
        if char == ESC:
            self._enter_escape()
            return
        if code < 0x20:
            self.handler.execute(char)
            return
        if state == ESCAPE:
            if char == "[":
                self.state = CSI
            elif char == "]":
                self._begin_string("]", OSC)
            elif char in "PX^_":
                self._begin_string(char, STRING)
            elif 0x20 <= code <= 0x2F:
                self._intermediates += char
                self.state = ESCAPE_INTERMEDIATE
            elif char != DEL:
                self.state = GROUND
                self.handler.esc_dispatch("", char)
            return
        if state == ESCAPE_INTERMEDIATE:
            if 0x20 <= code <= 0x2F:
                self._intermediates += char
            elif char != DEL:
                self.state = GROUND
                self.handler.esc_dispatch(self._intermediates, char)
            return
        if state == CSI:
            if char in "<=>?" and not self._params and not self._intermediates and not self._private:
                self._private = char
            elif ("0" <= char <= "9" or char in ":;") and not self._intermediates:
                self._params.append(char)
                if len(self._params) > MAX_PARAMS_LENGTH:
                    self.state = CSI_IGNORE
            elif 0x20 <= code <= 0x2F:
                self._intermediates += char
            elif 0x40 <= code <= 0x7E:
                self.state = GROUND
                self.handler.csi_dispatch(self._private, "".join(self._params), self._intermediates, char)
            elif char != DEL:
                self.state = CSI_IGNORE
            return
        if state == CSI_IGNORE:
            if 0x40 <= code <= 0x7E:
                self.state = GROUND

    def _begin_string(self, kind: str, state: int) -> None:
        self._string_kind = kind
        self._string = []
        self._string_size = 0
        self.state = state
