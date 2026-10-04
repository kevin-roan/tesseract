import re

ANSI_SEQUENCE = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]")
ERROR_LINE = re.compile(
    r"^\s*(?:error|fatal|panic|uncaught|unhandled|traceback)\b|\b\w*(?:error|exception)(?:\[\w+\])?:|\berror TS\d+",
    re.IGNORECASE,
)


def clean_log_text(text: str) -> str:
    trimmed = re.sub(r"[\r\n]+$", "", ANSI_SEQUENCE.sub("", text))
    return trimmed[trimmed.rfind("\r") + 1:]


def log_line_kind(stream: str, text: str) -> str:
    if stream == "stderr" and ERROR_LINE.search(text):
        return "error"
    return stream


def initials_of(name: str) -> str:
    return "".join(part[0].upper() for part in name.strip().split()[:2])
