import re
from dataclasses import dataclass, field
from typing import Literal

BlockKind = Literal["heading", "paragraph", "list", "code", "quote", "rule", "table"]
SAFE_SCHEMES = ("http://", "https://", "mailto:")
PLACEHOLDER = re.compile("(\\d+)")
PRIVATE_CHARS = re.compile("[]")

FENCE = re.compile(r"^\s{0,3}(`{3,}|~{3,})\s*([\w+#.-]*)")
HEADING = re.compile(r"^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$")
RULE = re.compile(r"^\s{0,3}([-*_])(\s*\1){2,}\s*$")
LIST_ITEM = re.compile(r"^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$")
TASK = re.compile(r"^\[([ xX])\]\s+(.*)$")
QUOTE = re.compile(r"^\s{0,3}>\s?(.*)$")
TABLE_ROW = re.compile(r"^\s*\|.*\|\s*$")
TABLE_DIVIDER = re.compile(r"^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$")

CODE_SPAN = re.compile(r"(`+)(.+?)\1", re.S)
LINK = re.compile(r"\[([^\]\n]+)\]\(\s*<?((?:[^()\s<>]|\([^()\s]*\))+)>?(?:\s+\"[^\"]*\")?\s*\)")
AUTOLINK = re.compile(r"<((?:https?://|mailto:)[^>\s]+)>")
BARE_URL = re.compile(r"(?<![\w/\"'=])(https?://[^\s<>()\[\]]*[^\s<>()\[\].,;:!?'\"])")
BOLD = (re.compile(r"\*\*(?=\S)(.+?)(?<=\S)\*\*"), re.compile(r"(?<![\w_])__(?=\S)(.+?)(?<=\S)__(?![\w_])"))
ITALIC = (
    re.compile(r"(?<![*\w])\*(?=[^\s*])(.+?)(?<=[^\s*])\*(?![*\w])"),
    re.compile(r"(?<![\w_])_(?=[^\s_])(.+?)(?<=[^\s_])_(?![\w_])"),
)
STRIKE = re.compile(r"~~(?=\S)(.+?)(?<=\S)~~")
TAG = re.compile(r"<(/?)(\w+)[^>]*>")
EMITTED_TAGS = frozenset({"b", "i", "s", "tt", "a", "span"})


@dataclass(frozen=True)
class ListItem:
    text: str
    depth: int = 0
    marker: str = "•"
    checked: bool | None = None


@dataclass(frozen=True)
class Block:
    kind: BlockKind
    text: str = ""
    level: int = 0
    language: str = ""
    items: tuple[ListItem, ...] = field(default_factory=tuple)
    rows: tuple[tuple[str, ...], ...] = field(default_factory=tuple)


MARKUP_ESCAPES = str.maketrans({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})


def escape(text: str) -> str:
    return text.translate(MARKUP_ESCAPES)


def safe_url(url: str) -> str | None:
    lowered = url.strip().lower()
    return url.strip() if lowered.startswith(SAFE_SCHEMES) else None


def is_balanced(markup: str) -> bool:
    stack: list[str] = []
    for match in TAG.finditer(markup):
        closing, name = match.group(1) == "/", match.group(2)
        if name not in EMITTED_TAGS:
            return False
        if not closing:
            stack.append(name)
        elif not stack or stack.pop() != name:
            return False
    return not stack


def inline_markup(text: str, code_color: str | None = None, code_background: str | None = None) -> str:
    source = PRIVATE_CHARS.sub("", text)
    atoms: list[str] = []

    def keep(markup: str) -> str:
        atoms.append(markup)
        return f"{len(atoms) - 1}"

    def code(match: re.Match[str]) -> str:
        attrs = ['font_family="monospace"']
        if code_color:
            attrs.append(f'foreground="{escape(code_color)}"')
        if code_background:
            attrs.append(f'background="{escape(code_background)}"')
        return keep(f"<span {' '.join(attrs)}>{escape(match.group(2).strip(' ') or match.group(2))}</span>")

    def link(label: str, url: str) -> str:
        target = safe_url(url)
        if target is None:
            return keep(escape(label))
        return keep(f'<a href="{escape(target)}">{escape(label)}</a>')

    source = CODE_SPAN.sub(code, source)
    source = LINK.sub(lambda m: link(m.group(1), m.group(2)), source)
    source = AUTOLINK.sub(lambda m: link(m.group(1), m.group(1)), source)
    source = BARE_URL.sub(lambda m: link(m.group(1), m.group(1)), source)

    plain = escape(source)
    styled = plain
    for pattern in BOLD:
        styled = pattern.sub(r"<b>\1</b>", styled)
    for pattern in ITALIC:
        styled = pattern.sub(r"<i>\1</i>", styled)
    styled = STRIKE.sub(r"<s>\1</s>", styled)
    if not is_balanced(styled):
        styled = plain

    def restore(value: str) -> str:
        return PLACEHOLDER.sub(lambda m: atoms[int(m.group(1))], value)

    return restore(styled)


def _table_cells(line: str) -> tuple[str, ...]:
    inner = line.strip()
    if inner.startswith("|"):
        inner = inner[1:]
    if inner.endswith("|"):
        inner = inner[:-1]
    return tuple(cell.strip() for cell in inner.split("|"))


def _list_item(indent: str, marker: str, text: str) -> ListItem:
    depth = len(indent.replace("\t", "    ")) // 2
    checked = None
    task = TASK.match(text)
    if task:
        checked = task.group(1).lower() == "x"
        text = task.group(2)
    return ListItem(text, min(depth, 4), "•" if marker in "-*+" else marker.replace(")", "."), checked)


def parse_blocks(text: str) -> list[Block]:
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    blocks: list[Block] = []
    paragraph: list[str] = []
    index = 0

    def flush() -> None:
        if paragraph:
            blocks.append(Block("paragraph", "\n".join(line.strip() for line in paragraph)))
            paragraph.clear()

    while index < len(lines):
        line = lines[index]
        fence = FENCE.match(line)
        if fence:
            flush()
            marker = fence.group(1)
            body: list[str] = []
            index += 1
            while index < len(lines) and not lines[index].strip().startswith(marker[0] * len(marker)):
                body.append(lines[index])
                index += 1
            blocks.append(Block("code", "\n".join(body), language=fence.group(2)))
            index += 1
            continue
        if not line.strip():
            flush()
            index += 1
            continue
        heading = HEADING.match(line)
        if heading:
            flush()
            blocks.append(Block("heading", heading.group(2), level=len(heading.group(1))))
            index += 1
            continue
        if RULE.match(line):
            flush()
            blocks.append(Block("rule"))
            index += 1
            continue
        if TABLE_ROW.match(line) and index + 1 < len(lines) and TABLE_DIVIDER.match(lines[index + 1]):
            flush()
            rows = [_table_cells(line)]
            index += 2
            while index < len(lines) and TABLE_ROW.match(lines[index]):
                rows.append(_table_cells(lines[index]))
                index += 1
            blocks.append(Block("table", rows=tuple(rows)))
            continue
        if QUOTE.match(line):
            flush()
            quoted: list[str] = []
            while index < len(lines) and (match := QUOTE.match(lines[index])):
                quoted.append(match.group(1))
                index += 1
            blocks.append(Block("quote", "\n".join(quoted).strip()))
            continue
        item = LIST_ITEM.match(line)
        if item and (not paragraph or not item.group(1)):
            flush()
            items: list[ListItem] = []
            while index < len(lines):
                current = lines[index]
                match = LIST_ITEM.match(current)
                if match:
                    items.append(_list_item(match.group(1), match.group(2), match.group(3)))
                elif current.strip() and current.startswith((" ", "\t")) and items:
                    last = items[-1]
                    items[-1] = ListItem(f"{last.text} {current.strip()}", last.depth, last.marker, last.checked)
                else:
                    break
                index += 1
            blocks.append(Block("list", items=tuple(items)))
            continue
        paragraph.append(line)
        index += 1
    flush()
    return blocks


def table_text(rows: tuple[tuple[str, ...], ...]) -> str:
    if not rows:
        return ""
    columns = max(len(row) for row in rows)
    padded = [tuple(row) + ("",) * (columns - len(row)) for row in rows]
    widths = [max(len(row[column]) for row in padded) for column in range(columns)]
    lines = ["  ".join(cell.ljust(widths[i]) for i, cell in enumerate(row)).rstrip() for row in padded]
    lines.insert(1, "  ".join("─" * width for width in widths))
    return "\n".join(lines)


def plain_text(text: str) -> str:
    stripped = CODE_SPAN.sub(lambda m: m.group(2), text)
    stripped = LINK.sub(lambda m: m.group(1), stripped)
    for pattern in (*BOLD, *ITALIC, STRIKE):
        stripped = pattern.sub(r"\1", stripped)
    return stripped
