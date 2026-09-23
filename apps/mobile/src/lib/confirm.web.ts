import type { ConfirmOptions } from "./confirm";

export function confirm({ title, message }: ConfirmOptions): Promise<boolean> {
  if (typeof window === "undefined" || typeof window.confirm !== "function") return Promise.resolve(false);
  return Promise.resolve(window.confirm(`${title}\n\n${message}`));
}
