import type { TailnetStatus } from "@tesseract/protocol";

import { useTailnetStore } from "../store/tailnet-store";

export function useTailnetStatus(): TailnetStatus | null {
  return useTailnetStore((state) => state.status);
}
