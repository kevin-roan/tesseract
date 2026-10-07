export interface ListItem {
  text: string;
  depth: number;
  marker: string;
  checked: boolean | null;
}

export type Block =
  | { kind: "heading"; text: string; level: number }
  | { kind: "paragraph"; text: string }
  | { kind: "code"; text: string; language: string }
  | { kind: "quote"; text: string }
  | { kind: "rule" }
  | { kind: "list"; items: ListItem[] }
  | { kind: "table"; rows: string[][] };

export type InlineNode =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; href: string; label: string }
  | { type: "strong" | "em" | "strike"; children: InlineNode[] };

const W = "\\p{L}\\p{N}_";
const OPEN = "";
const CLOSE = "";
const SAFE_SCHEMES = ["http://", "https://", "mailto:"] as const;
const MAX_DEPTH = 4;
const TAB_SPACES = "    ";
const BULLET = "•";

const FENCE = new RegExp(`^\\s{0,3}(\`{3,}|~{3,})\\s*([${W}+#.-]*)`, "u");
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/u;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/u;
const LIST_ITEM = /^(\s*)([-*+]|\p{Nd}{1,9}[.)])\s+(.*)$/u;
const TASK = /^\[([ xX])\]\s+(.*)$/u;
const QUOTE = /^\s{0,3}>\s?(.*)$/u;
const TABLE_ROW = /^\s*\|.*\|\s*$/u;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/u;

const PRIVATE_CHARS = /[]/gu;
const CODE_SPAN = /(`+)([\s\S]+?)\1/gu;
const LINK = /\[([^\]\n]+)\]\(\s*<?((?:[^()\s<>]|\([^()\s]*\))+)>?(?:\s+"[^"]*")?\s*\)/gu;
const AUTOLINK = /<((?:https?:\/\/|mailto:)[^>\s]+)>/gu;
const BARE_URL = new RegExp(`(?<![${W}/"'=])(https?://[^\\s<>()\\[\\]]*[^\\s<>()\\[\\].,;:!?'"])`, "gu");
const BOLD = [
  /\*\*(?=\S)(.+?)(?<=\S)\*\*/gu,
  new RegExp(`(?<![${W}])__(?=\\S)(.+?)(?<=\\S)__(?![${W}])`, "gu"),
];
const ITALIC = [
  new RegExp(`(?<![*${W}])\\*(?=[^\\s*])(.+?)(?<=[^\\s*])\\*(?![*${W}])`, "gu"),
  new RegExp(`(?<![${W}])_(?=[^\\s_])(.+?)(?<=[^\\s_])_(?![${W}])`, "gu"),
];
const STRIKE = /~~(?=\S)(.+?)(?<=\S)~~/gu;
const TAG = /<(\/?)(\w+)[^>]*>/gu;
const EMITTED_TAGS = new Set(["b", "i", "s"]);
const TOKEN = /<(\/?)([bis])>|(\d+)/gu;

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const UNESCAPES: Record<string, string> = Object.fromEntries(Object.entries(ESCAPES).map(([raw, entity]) => [entity, raw]));
const TAG_NODE = { b: "strong", i: "em", s: "strike" } as const;

const escape = (text: string) => text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
const unescape = (text: string) => text.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => UNESCAPES[entity] ?? entity);

export function safeUrl(url: string): string | null {
  const trimmed = url.trim();
  const lowered = trimmed.toLowerCase();
  return SAFE_SCHEMES.some((scheme) => lowered.startsWith(scheme)) ? trimmed : null;
}

function isBalanced(markup: string): boolean {
  const stack: string[] = [];
  for (const match of markup.matchAll(TAG)) {
    const closing = match[1] === "/";
    const name = match[2] ?? "";
    if (!EMITTED_TAGS.has(name)) return false;
    if (!closing) stack.push(name);
    else if (stack.pop() !== name) return false;
  }
  return stack.length === 0;
}

function trimSpaces(text: string): string {
  return text.replace(/^ +| +$/g, "");
}

export function parseInline(text: string): InlineNode[] {
  const atoms: InlineNode[] = [];
  const keep = (node: InlineNode) => {
    atoms.push(node);
    return `${OPEN}${atoms.length - 1}${CLOSE}`;
  };
  const link = (label: string, url: string) => {
    const href = safeUrl(url);
    return keep(href === null ? { type: "text", text: label } : { type: "link", href, label });
  };

  let source = text.replace(PRIVATE_CHARS, "");
  source = source.replace(CODE_SPAN, (_match, _ticks: string, body: string) =>
    keep({ type: "code", text: trimSpaces(body) || body }),
  );
  source = source.replace(LINK, (_match, label: string, url: string) => link(label, url));
  source = source.replace(AUTOLINK, (_match, url: string) => link(url, url));
  source = source.replace(BARE_URL, (_match, url: string) => link(url, url));

  const plain = escape(source);
  let styled = plain;
  for (const pattern of BOLD) styled = styled.replace(pattern, "<b>$1</b>");
  for (const pattern of ITALIC) styled = styled.replace(pattern, "<i>$1</i>");
  styled = styled.replace(STRIKE, "<s>$1</s>");
  if (!isBalanced(styled)) styled = plain;

  return toNodes(styled, atoms);
}

function toNodes(markup: string, atoms: InlineNode[]): InlineNode[] {
  const root: InlineNode[] = [];
  const stack: InlineNode[][] = [root];
  const current = () => stack[stack.length - 1] ?? root;
  const pushText = (raw: string) => {
    if (!raw) return;
    const value = unescape(raw);
    const target = current();
    const last = target[target.length - 1];
    if (last?.type === "text") last.text += value;
    else target.push({ type: "text", text: value });
  };
  let cursor = 0;
  for (const match of markup.matchAll(TOKEN)) {
    pushText(markup.slice(cursor, match.index));
    cursor = match.index + match[0].length;
    if (match[3] !== undefined) {
      const atom = atoms[Number(match[3])];
      if (atom?.type === "text") pushText(escape(atom.text));
      else if (atom) current().push(atom);
      continue;
    }
    if (match[1] === "/") {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const node: InlineNode = { type: TAG_NODE[match[2] as keyof typeof TAG_NODE], children: [] };
    current().push(node);
    stack.push(node.children);
  }
  pushText(markup.slice(cursor));
  return root;
}

function tableCells(line: string): string[] {
  let inner = line.trim();
  if (inner.startsWith("|")) inner = inner.slice(1);
  if (inner.endsWith("|")) inner = inner.slice(0, -1);
  return inner.split("|").map((cell) => cell.trim());
}

function listItem(indent: string, marker: string, raw: string): ListItem {
  const depth = Math.floor(indent.replaceAll("\t", TAB_SPACES).length / 2);
  let text = raw;
  let checked: boolean | null = null;
  const task = TASK.exec(raw);
  if (task) {
    checked = (task[1] ?? "").toLowerCase() === "x";
    text = task[2] ?? "";
  }
  return {
    text,
    depth: Math.min(depth, MAX_DEPTH),
    marker: "-*+".includes(marker) ? BULLET : marker.replace(")", "."),
    checked,
  };
}

export function parseBlocks(input: string): Block[] {
  const lines = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const blocks: Block[] = [];
  const paragraph: string[] = [];
  let index = 0;

  const flush = () => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: "paragraph", text: paragraph.map((line) => line.trim()).join("\n") });
    paragraph.length = 0;
  };

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const fence = FENCE.exec(line);
    if (fence) {
      flush();
      const marker = fence[1] ?? "```";
      const closing = (marker[0] ?? "`").repeat(marker.length);
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? "").trim().startsWith(closing)) {
        body.push(lines[index] ?? "");
        index += 1;
      }
      blocks.push({ kind: "code", text: body.join("\n"), language: fence[2] ?? "" });
      index += 1;
      continue;
    }
    if (!line.trim()) {
      flush();
      index += 1;
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: "heading", text: heading[2] ?? "", level: (heading[1] ?? "#").length });
      index += 1;
      continue;
    }
    if (RULE.test(line)) {
      flush();
      blocks.push({ kind: "rule" });
      index += 1;
      continue;
    }
    if (TABLE_ROW.test(line) && index + 1 < lines.length && TABLE_DIVIDER.test(lines[index + 1] ?? "")) {
      flush();
      const rows = [tableCells(line)];
      index += 2;
      while (index < lines.length && TABLE_ROW.test(lines[index] ?? "")) {
        rows.push(tableCells(lines[index] ?? ""));
        index += 1;
      }
      blocks.push({ kind: "table", rows });
      continue;
    }
    if (QUOTE.test(line)) {
      flush();
      const quoted: string[] = [];
      let match: RegExpExecArray | null;
      while (index < lines.length && (match = QUOTE.exec(lines[index] ?? ""))) {
        quoted.push(match[1] ?? "");
        index += 1;
      }
      blocks.push({ kind: "quote", text: quoted.join("\n").trim() });
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item && (paragraph.length === 0 || !item[1])) {
      flush();
      const items: ListItem[] = [];
      while (index < lines.length) {
        const current = lines[index] ?? "";
        const match = LIST_ITEM.exec(current);
        const last = items[items.length - 1];
        if (match) items.push(listItem(match[1] ?? "", match[2] ?? "", match[3] ?? ""));
        else if (current.trim() && (current.startsWith(" ") || current.startsWith("\t")) && last) {
          items[items.length - 1] = { ...last, text: `${last.text} ${current.trim()}` };
        } else break;
        index += 1;
      }
      blocks.push({ kind: "list", items });
      continue;
    }
    paragraph.push(line);
    index += 1;
  }
  flush();
  return blocks;
}

export function blockSignature(block: Block): string {
  return JSON.stringify(block);
}
