import re

ANSI_SEQUENCE = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]")


def clean_log_text(text: str) -> str:
    trimmed = re.sub(r"[\r\n]+$", "", ANSI_SEQUENCE.sub("", text))
    return trimmed[trimmed.rfind("\r") + 1:]


def initials_of(name: str) -> str:
    return "".join(part[0].upper() for part in name.strip().split()[:2])
