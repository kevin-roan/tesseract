import { useMemo } from "react";
import { currentPlatform } from "../../app/runtime";
import type { Platform } from "../../../shared/runtime";
import { formatAccelerator } from "./format";
import { PLAIN_SEPARATOR } from "./keys";

export function useKeyLabels(keys: string | readonly string[], platform?: Platform) {
  const resolved = platform ?? currentPlatform();
  const labels = useMemo(() => formatAccelerator(keys, resolved), [keys, resolved]);
  return { labels, separator: PLAIN_SEPARATOR[resolved] };
}
