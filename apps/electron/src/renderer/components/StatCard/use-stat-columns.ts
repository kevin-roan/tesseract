import { useLayoutEffect, useRef, useState } from "react";
import { statColumns } from "./model";

export function useStatColumns(minColumns: number, maxColumns: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(minColumns);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setColumns(statColumns(element.getBoundingClientRect().width, minColumns, maxColumns));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [minColumns, maxColumns]);
  return { ref, columns };
}
