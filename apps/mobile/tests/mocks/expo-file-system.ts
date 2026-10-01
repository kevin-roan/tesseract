export const files: Record<string, { base64: string; size: number }> = {};

type Part = string | { uri: string };

export const Paths = { cache: { uri: "file:///cache/" } };

export class File {
  readonly uri: string;

  constructor(...parts: Part[]) {
    this.uri = parts.map((part) => (typeof part === "string" ? part : part.uri)).join("");
  }

  create(): void {
    files[this.uri] = { base64: "", size: 0 };
  }

  write(content: string): void {
    files[this.uri] = { base64: content, size: Math.floor((content.length * 3) / 4) };
  }

  get exists(): boolean {
    return this.uri in files;
  }

  get size(): number {
    return files[this.uri]?.size ?? 0;
  }

  async base64(): Promise<string> {
    const entry = files[this.uri];
    if (!entry) throw new Error(`Missing file ${this.uri}`);
    return entry.base64;
  }
}

export function __setFile(uri: string, base64: string, size = Math.floor((base64.length * 3) / 4)): void {
  files[uri] = { base64, size };
}

export function __reset(): void {
  Object.keys(files).forEach((key) => delete files[key]);
}
