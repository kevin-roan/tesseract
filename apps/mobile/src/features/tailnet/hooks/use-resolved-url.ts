import { useEffect, useState } from "react";

import { peekTailnetUrl, resolveTailnetUrl } from "../services/tailnet";
import { useTailnetStatus } from "./use-tailnet-status";

type Resolution = { source: string; value: string };

export function useResolvedUrl(url: string | null): string | null {
  const state = useTailnetStatus()?.state ?? null;
  const peeked = url ? peekTailnetUrl(url) : null;
  const [resolution, setResolution] = useState<Resolution | null>(null);

  useEffect(() => {
    if (!url || peeked !== null) return;
    let live = true;
    const settle = (value: string) => {
      if (live) setResolution({ source: url, value });
    };
    resolveTailnetUrl(url).then(settle, () => settle(url));
    return () => {
      live = false;
    };
  }, [url, peeked, state]);

  if (!url) return null;
  if (peeked !== null) return peeked;
  return resolution?.source === url ? resolution.value : null;
}
