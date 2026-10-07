export interface XmlElement {
  name: string;
  qname: string;
  attrs: Record<string, string>;
  children: XmlNode[];
}

export type XmlNode = XmlElement | string;

const NAMED_ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
const ATTRIBUTE = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

export class XmlParseError extends Error {
  constructor(message: string, readonly offset: number) {
    super(`${message} at offset ${offset}`);
    this.name = "XmlParseError";
  }
}

export function localName(qname: string): string {
  const colon = qname.indexOf(":");
  return colon === -1 ? qname : qname.slice(colon + 1);
}

export function decodeEntities(text: string): string {
  if (!text.includes("&")) return text;
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z]+);/g, (whole, body: string) => {
    if (body.startsWith("#x")) return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    if (body.startsWith("#")) return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    return NAMED_ENTITIES[body] ?? whole;
  });
}

export function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function parseAttributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of source.matchAll(ATTRIBUTE)) {
    const qname = match[1] as string;
    if (qname === "xmlns" || qname.startsWith("xmlns:")) continue;
    attrs[localName(qname)] = decodeEntities(match[2] ?? match[3] ?? "");
  }
  return attrs;
}

function skipPast(xml: string, from: number, marker: string): number {
  const end = xml.indexOf(marker, from);
  if (end === -1) throw new XmlParseError(`Unterminated ${marker}`, from);
  return end + marker.length;
}

export function parseXml(xml: string): XmlElement {
  const root: XmlElement = { name: "#document", qname: "#document", attrs: {}, children: [] };
  const stack: XmlElement[] = [root];
  let index = 0;
  while (index < xml.length) {
    const open = xml.indexOf("<", index);
    const current = stack[stack.length - 1] as XmlElement;
    if (open === -1) {
      if (xml.slice(index).trim()) current.children.push(decodeEntities(xml.slice(index)));
      break;
    }
    if (open > index) current.children.push(decodeEntities(xml.slice(index, open)));
    if (xml.startsWith("<!--", open)) {
      index = skipPast(xml, open + 4, "-->");
    } else if (xml.startsWith("<![CDATA[", open)) {
      const end = xml.indexOf("]]>", open + 9);
      if (end === -1) throw new XmlParseError("Unterminated CDATA", open);
      current.children.push(xml.slice(open + 9, end));
      index = end + 3;
    } else if (xml.startsWith("<?", open)) {
      index = skipPast(xml, open + 2, "?>");
    } else if (xml.startsWith("<!", open)) {
      index = skipPast(xml, open + 2, ">");
    } else if (xml.startsWith("</", open)) {
      const end = skipPast(xml, open + 2, ">");
      const qname = xml.slice(open + 2, end - 1).trim();
      if (stack.length === 1 || current.qname !== qname) throw new XmlParseError(`Unexpected </${qname}>`, open);
      stack.pop();
      index = end;
    } else {
      const end = findTagEnd(xml, open + 1);
      const selfClosing = xml[end - 1] === "/";
      const body = xml.slice(open + 1, selfClosing ? end - 1 : end);
      const nameEnd = body.search(/[\s/>]|$/);
      const qname = body.slice(0, nameEnd);
      if (!qname) throw new XmlParseError("Missing element name", open);
      const element: XmlElement = { name: localName(qname), qname, attrs: parseAttributes(body.slice(nameEnd)), children: [] };
      current.children.push(element);
      if (!selfClosing) stack.push(element);
      index = end + 1;
    }
  }
  if (stack.length !== 1) throw new XmlParseError(`Unclosed <${(stack[stack.length - 1] as XmlElement).qname}>`, xml.length);
  const top = root.children.find((child): child is XmlElement => typeof child !== "string");
  if (!top) throw new XmlParseError("No root element", 0);
  return top;
}

function findTagEnd(xml: string, from: number): number {
  let quote: string | null = null;
  for (let index = from; index < xml.length; index += 1) {
    const char = xml[index];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ">") {
      return index;
    }
  }
  throw new XmlParseError("Unterminated tag", from);
}

export function childElements(element: XmlElement, name?: string): XmlElement[] {
  return element.children.filter(
    (child): child is XmlElement => typeof child !== "string" && (name === undefined || child.name === name),
  );
}

export function child(element: XmlElement, name: string): XmlElement | null {
  return childElements(element, name)[0] ?? null;
}

export function textContent(element: XmlElement | null): string {
  if (!element) return "";
  return element.children.map((node) => (typeof node === "string" ? node : textContent(node))).join("");
}

export function childText(element: XmlElement, name: string): string | null {
  const found = child(element, name);
  return found ? textContent(found).trim() : null;
}

export function serializeXml(element: XmlElement, indent = "", step = "  "): string {
  const attrs = Object.entries(element.attrs)
    .map(([key, value]) => ` ${key}="${escapeXml(value)}"`)
    .join("");
  const elements = childElements(element);
  if (elements.length === 0) {
    const text = textContent(element).trim();
    return text ? `${indent}<${element.name}${attrs}>${escapeXml(text)}</${element.name}>` : `${indent}<${element.name}${attrs}/>`;
  }
  const inner = elements.map((node) => serializeXml(node, indent + step, step)).join("\n");
  return `${indent}<${element.name}${attrs}>\n${inner}\n${indent}</${element.name}>`;
}
