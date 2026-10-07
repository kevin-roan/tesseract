import { useCallback, useEffect, useState } from "react";

export interface ElementSize {
  width: number;
  height: number;
}

export function useElementSize<T extends HTMLElement>(): [(element: T | null) => void, ElementSize | null, T | null] {
  const [element, setElement] = useState<T | null>(null);
  const [size, setSize] = useState<ElementSize | null>(null);
  const ref = useCallback((node: T | null) => setElement(node), []);
  useEffect(() => {
    if (!element) return undefined;
    const rect = element.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [ref, size, element];
}
