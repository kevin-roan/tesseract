import { useCallback, useEffect, useRef, useState } from "react";
import { COPY_RESET_MS } from "./constants";
import { copyText } from "./copy-text";

export function useCopyFeedback(resetMs: number = COPY_RESET_MS) {
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

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      const ok = await copyText(text);
      if (!ok || !mounted.current) return ok;
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        setCopied(false);
      }, resetMs);
      return ok;
    },
    [resetMs],
  );

  return { copied, copy };
}
