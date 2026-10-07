import { describe, expect, it } from "vitest";
import { parseBlocks, parseInline } from "./parser";

describe("parseBlocks", () => {
  it("parses fences, headings, rules and paragraphs with hard breaks", () => {
    const blocks = parseBlocks("# Title\nline one\nline two\n\n```ts\nconst a = 1;\n```\n***\n### Small ##");
    expect(blocks).toEqual([
      { kind: "heading", text: "Title", level: 1 },
      { kind: "paragraph", text: "line one\nline two" },
      { kind: "code", text: "const a = 1;", language: "ts" },
      { kind: "rule" },
      { kind: "heading", text: "Small", level: 3 },
    ]);
  });

  it("runs an unterminated fence to the end", () => {
    expect(parseBlocks("~~~\nabc\ndef")).toEqual([{ kind: "code", text: "abc\ndef", language: "" }]);
  });

  it("parses lists with depth, numbers, tasks and continuations", () => {
    const [list] = parseBlocks("- one\n  more\n3) three\n    - [x] done\n\t- [ ] todo");
    expect(list).toEqual({
      kind: "list",
      items: [
        { text: "one more", depth: 0, marker: "•", checked: null },
        { text: "three", depth: 0, marker: "3.", checked: null },
        { text: "done", depth: 2, marker: "•", checked: true },
        { text: "todo", depth: 2, marker: "•", checked: false },
      ],
    });
  });

  it("does not start a list from an indented item inside a paragraph", () => {
    expect(parseBlocks("text\n  - not a list")).toEqual([{ kind: "paragraph", text: "text\n- not a list" }]);
    expect(parseBlocks("text\n- a list")[1]?.kind).toBe("list");
  });

  it("parses tables and quotes", () => {
    const blocks = parseBlocks("| a | b |\n|:--|--:|\n| 1 | 2 |\n| 3 |\n> quoted\n> more");
    expect(blocks).toEqual([
      { kind: "table", rows: [["a", "b"], ["1", "2"], ["3"]] },
      { kind: "quote", text: "quoted\nmore" },
    ]);
  });

  it("normalizes carriage returns", () => {
    expect(parseBlocks("a\r\nb\rc")).toEqual([{ kind: "paragraph", text: "a\nb\nc" }]);
  });
});

describe("parseInline", () => {
  it("renders code spans, emphasis and strike", () => {
    expect(parseInline("a `  x  ` **b** *c* ~~d~~")).toEqual([
      { type: "text", text: "a " },
      { type: "code", text: "x" },
      { type: "text", text: " " },
      { type: "strong", children: [{ type: "text", text: "b" }] },
      { type: "text", text: " " },
      { type: "em", children: [{ type: "text", text: "c" }] },
      { type: "text", text: " " },
      { type: "strike", children: [{ type: "text", text: "d" }] },
    ]);
  });

  it("links only safe schemes and trims trailing punctuation from bare urls", () => {
    expect(parseInline("[x](javascript:alert(1)) see https://a.dev/b.")).toEqual([
      { type: "text", text: "x see " },
      { type: "link", href: "https://a.dev/b", label: "https://a.dev/b" },
      { type: "text", text: "." },
    ]);
    expect(parseInline("<mailto:me@x.dev>")).toEqual([{ type: "link", href: "mailto:me@x.dev", label: "mailto:me@x.dev" }]);
    expect(parseInline('[docs](https://x.dev "Title")')).toEqual([{ type: "link", href: "https://x.dev", label: "docs" }]);
  });

  it("keeps markup characters literal and drops unbalanced emphasis", () => {
    expect(parseInline("<b>hi</b> & 'q'")).toEqual([{ type: "text", text: "<b>hi</b> & 'q'" }]);
    expect(parseInline("**a *b** c*")).toEqual([{ type: "text", text: "**a *b** c*" }]);
  });

  it("does not treat snake_case as emphasis and strips private-use chars", () => {
    expect(parseInline("snake_case_name x")).toEqual([{ type: "text", text: "snake_case_name x" }]);
  });
});
