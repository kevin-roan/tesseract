import { type RefObject, useLayoutEffect } from "react";
import { clampHeight } from "./model";

export function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string, minHeight: number, maxHeight: number): void {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    const content = element.scrollHeight;
    element.style.height = `${clampHeight(content, minHeight, maxHeight)}px`;
    element.style.overflowY = content > maxHeight ? "auto" : "hidden";
  }, [ref, value, minHeight, maxHeight]);
}
