import { useEffect, useState } from "react";

export interface ElementSize {
  width: number;
  height: number;
}

const EMPTY: ElementSize = { width: 0, height: 0 };

export function useElementSize(element: HTMLElement | null): ElementSize {
  const [size, setSize] = useState<ElementSize>(EMPTY);
  useEffect(() => {
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      setSize((previous) => (previous.width === width && previous.height === height ? previous : { width, height }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return size;
}
