export function messageText(data: unknown): string | null {
  if (typeof data === "string") return data;
  if (typeof data !== "object" || data === null) return null;
  try {
    return JSON.stringify(data);
  } catch {
    return null;
  }
}
