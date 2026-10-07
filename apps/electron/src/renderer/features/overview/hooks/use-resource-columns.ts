import { useLayoutEffect, useRef, useState } from "react";
import { RESOURCE_GRID } from "../constants";
import { resourceColumns } from "../model";

export function useResourceColumns() {
  const ref = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState<number>(RESOURCE_GRID.wide);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setColumns(resourceColumns(element.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, columns };
}
