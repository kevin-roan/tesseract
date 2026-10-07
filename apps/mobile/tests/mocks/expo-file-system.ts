export const files: Record<string, { base64: string; size: number }> = {};

type Part = string | { uri: string };

export const Paths = { cache: { uri: "file:///cache/" }, document: { uri: "file:///document/" } };

type DownloadOptions = { onProgress?: (data: { bytesWritten: number; totalBytes: number }) => void };

export const downloads: { url: string; uri: string }[] = [];
let downloadSize: number | null = null;
let downloadError: Error | null = null;

export class File {
  readonly uri: string;

  constructor(...parts: Part[]) {
    const [first = "", ...rest] = parts.map((part) => (typeof part === "string" ? part : part.uri));
    this.uri = [first.replace(/\/+$/, ""), ...rest.map((part) => part.replace(/^\/+|\/+$/g, ""))].join("/");
  }

  static createDownloadTask(url: string, destination: File, options: DownloadOptions = {}) {
    return {
      downloadAsync: async (): Promise<File> => {
        if (downloadError) throw downloadError;
        const size = downloadSize ?? 0;
        options.onProgress?.({ bytesWritten: size / 2, totalBytes: size });
        files[destination.uri] = { base64: "", size };
        downloads.push({ url, uri: destination.uri });
        return destination;
      },
    };
  }

  get parentDirectory() {
    return { uri: this.uri.slice(0, this.uri.lastIndexOf("/") + 1), create: () => undefined };
  }

  delete(): void {
    delete files[this.uri];
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

export function __setDownload(size: number | null, error: Error | null = null): void {
  downloadSize = size;
  downloadError = error;
}

export function __reset(): void {
  Object.keys(files).forEach((key) => delete files[key]);
  downloads.length = 0;
  downloadSize = null;
  downloadError = null;
}
