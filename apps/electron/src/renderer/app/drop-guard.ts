import { useEffect } from "react";

function refuseDragOver(event: DragEvent): void {
  if (event.defaultPrevented) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "none";
}

function refuseDrop(event: DragEvent): void {
  event.preventDefault();
}

export function useStrayDropGuard(): void {
  useEffect(() => {
    window.addEventListener("dragover", refuseDragOver);
    window.addEventListener("drop", refuseDrop);
    return () => {
      window.removeEventListener("dragover", refuseDragOver);
      window.removeEventListener("drop", refuseDrop);
    };
  }, []);
}
