import { useCallback, useEffect, useRef, useState } from "react";

import { COPY_FEEDBACK_MS, Clipboard } from "@/lib/clipboard";
import { playHaptic } from "@/lib/haptics";

export function useCopyText(text: string) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(async () => {
    if (!Clipboard) return;
    try {
      await Clipboard.setStringAsync(text);
    } catch {
      return;
    }
    if (!mounted.current) return;
    playHaptic("selection");
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  }, [text]);

  return { copied, copy, canCopy: Clipboard !== null };
}
