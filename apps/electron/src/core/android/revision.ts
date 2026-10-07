export interface Revision {
  major: number;
  minor: number | null;
  micro: number | null;
  preview: number | null;
}

export function revision(major: number, minor: number | null = null, micro: number | null = null, preview: number | null = null): Revision {
  return { major, minor, micro, preview };
}

export function parseRevision(text: string | null | undefined): Revision | null {
  if (!text) return null;
  const match = /^\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\s*-?\s*rc\s*(\d+))?\s*$/i.exec(text);
  if (!match) return null;
  const number = (value: string | undefined) => (value === undefined ? null : Number(value));
  return revision(Number(match[1]), number(match[2]), number(match[3]), number(match[4]));
}

export function formatRevision(value: Revision): string {
  const parts = [value.major, value.minor, value.micro];
  while (parts.length > 1 && parts[parts.length - 1] === null) parts.pop();
  const base = parts.map((part) => part ?? 0).join(".");
  return value.preview === null ? base : `${base} rc${value.preview}`;
}

export function compareRevisions(a: Revision, b: Revision): number {
  const fields = [
    [a.major, b.major],
    [a.minor ?? 0, b.minor ?? 0],
    [a.micro ?? 0, b.micro ?? 0],
  ] as const;
  for (const [left, right] of fields) if (left !== right) return left - right;
  if (a.preview === b.preview) return 0;
  if (a.preview === null) return 1;
  if (b.preview === null) return -1;
  return a.preview - b.preview;
}

export function compareRevisionStrings(a: string, b: string): number {
  const left = parseRevision(a);
  const right = parseRevision(b);
  if (!left || !right) return a.localeCompare(b);
  return compareRevisions(left, right);
}
