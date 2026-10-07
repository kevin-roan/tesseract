import { useCallback, useEffect, useState } from "react";

export function useElementWidth<T extends HTMLElement>(): [(element: T | null) => void, number | null] {
  const [element, setElement] = useState<T | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  const ref = useCallback((node: T | null) => setElement(node), []);
  useEffect(() => {
    if (!element) return undefined;
    setWidth(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [ref, width];
}
