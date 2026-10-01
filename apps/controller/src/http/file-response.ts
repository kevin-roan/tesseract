export type FileResponseOptions = {
  fileName: string;
  contentType: string;
  disposition?: "attachment" | "inline";
  range?: string | null;
  headers?: Record<string, string>;
};

const RANGE_PATTERN = /^bytes=(\d*)-(\d*)$/;

export function contentDisposition(type: "attachment" | "inline", fileName: string): string {
  return `${type}; filename="${fileName.replace(/[^\x20-\x7e]|["\\]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export type ByteRange = { start: number; end: number };

/**
 * Inclusive byte range of a single-range `Range` header. Null means serve the whole file
 * (no header, or one this parser does not handle); "unsatisfiable" means 416.
 */
export function parseRange(header: string | null | undefined, size: number): ByteRange | "unsatisfiable" | null {
  const match = RANGE_PATTERN.exec(header?.trim() ?? "");
  if (!match) return null;
  const [, from = "", to = ""] = match;
  if (!from && !to) return null;
  if (!from) {
    const suffix = Number(to);
    return suffix > 0 && size > 0 ? { start: Math.max(0, size - suffix), end: size - 1 } : "unsatisfiable";
  }
  const start = Number(from);
  const end = to ? Math.min(Number(to), size - 1) : size - 1;
  return start <= end ? { start, end } : "unsatisfiable";
}

/** Streams a file; a single `Range: bytes=` request gets a 206 slice so media players can seek. */
export function fileResponse(path: string, options: FileResponseOptions): Response {
  const file = Bun.file(path);
  const headers: Record<string, string> = {
    "Content-Type": options.contentType,
    "Content-Disposition": contentDisposition(options.disposition ?? "attachment", options.fileName),
    "Cache-Control": "no-store",
    "Accept-Ranges": "bytes",
    ...options.headers,
  };
  const range = parseRange(options.range, file.size);
  if (range) {
    if (range === "unsatisfiable") return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${file.size}` } });
    headers["Content-Range"] = `bytes ${range.start}-${range.end}/${file.size}`;
    return new Response(file.slice(range.start, range.end + 1), { status: 206, headers });
  }
  return new Response(file, { headers });
}
