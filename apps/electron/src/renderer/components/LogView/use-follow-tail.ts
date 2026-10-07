import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

export interface FollowTailOptions {
  threshold: number;
  scrollerRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLElement | null>;
  changeKey?: unknown;
}

function distanceToEnd(element: HTMLElement): number {
  return element.scrollHeight - element.clientHeight - element.scrollTop;
}

export function useFollowTail({ threshold, scrollerRef, contentRef, changeKey }: FollowTailOptions) {
  const following = useRef(true);
  const [detached, setDetached] = useState(false);

  const scrollToEnd = useCallback(() => {
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [scrollerRef]);

  const evaluate = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    following.current = distanceToEnd(scroller) <= threshold;
    setDetached(!following.current);
  }, [scrollerRef, threshold]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.addEventListener("scroll", evaluate, { passive: true });
    return () => scroller.removeEventListener("scroll", evaluate);
  }, [scrollerRef, evaluate]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => (following.current ? scrollToEnd() : evaluate()));
    });
    observer.observe(content);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [contentRef, evaluate, scrollToEnd]);

  useLayoutEffect(() => {
    if (following.current) scrollToEnd();
    else evaluate();
  }, [changeKey, scrollToEnd, evaluate]);

  const jumpToEnd = useCallback(() => {
    following.current = true;
    setDetached(false);
    scrollToEnd();
    requestAnimationFrame(scrollToEnd);
  }, [scrollToEnd]);

  const reset = useCallback(() => {
    following.current = true;
    setDetached(false);
  }, []);

  return { detached, jumpToEnd, reset };
}
