import { type ClipboardEvent, type DragEvent, useRef, useState } from "react";

const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");

export interface FileDrop {
  dragging: boolean;
  handlers: {
    onDragEnter(event: DragEvent): void;
    onDragOver(event: DragEvent): void;
    onDragLeave(event: DragEvent): void;
    onDrop(event: DragEvent): void;
    onPaste(event: ClipboardEvent): void;
  } | null;
}

export function useFileDrop(onFiles: ((files: File[]) => void) | undefined, disabled = false): FileDrop {
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);
  if (!onFiles || disabled) return { dragging: false, handlers: null };
  const reset = () => {
    depth.current = 0;
    setDragging(false);
  };
  return {
    dragging,
    handlers: {
      onDragEnter: (event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        depth.current += 1;
        setDragging(true);
      },
      onDragOver: (event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      },
      onDragLeave: (event) => {
        if (!hasFiles(event)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      },
      onDrop: (event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        reset();
        const files = Array.from(event.dataTransfer.files);
        if (files.length > 0) onFiles(files);
      },
      onPaste: (event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (files.length === 0) return;
        event.preventDefault();
        onFiles(files);
      },
    },
  };
}
