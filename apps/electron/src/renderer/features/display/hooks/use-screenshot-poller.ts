import type { TheOneClient } from "@theone/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePoller } from "../../../app/connection";
import { SCREENSHOT_POLL_MS } from "../constants";
import { imageMimeType } from "../model";

async function decodePicture(buffer: ArrayBuffer): Promise<string | null> {
  const bytes = new Uint8Array(buffer);
  const url = URL.createObjectURL(new Blob([bytes], { type: imageMimeType(bytes) }));
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
    return url;
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

export function useScreenshotPoller(client: TheOneClient | null, enabled: boolean, keepPicture: boolean): string | null {
  const [picture, setPicture] = useState<string | null>(null);
  const current = useRef<string | null>(null);
  const generation = useRef(0);
  const live = useRef(enabled);
  live.current = enabled;

  const replace = useCallback((next: string | null) => {
    const previous = current.current;
    current.current = next;
    setPicture(next);
    if (previous && previous !== next) URL.revokeObjectURL(previous);
  }, []);

  const onResult = useCallback(
    (buffer: ArrayBuffer) => {
      const started = generation.current;
      void decodePicture(buffer).then((url) => {
        if (!url) return;
        if (started !== generation.current || !live.current) {
          URL.revokeObjectURL(url);
          return;
        }
        replace(url);
      });
    },
    [replace],
  );

  usePoller((signal) => (client ? client.screenshot({ signal }) : Promise.reject(new Error())), SCREENSHOT_POLL_MS, {
    enabled: enabled && client !== null,
    onResult,
  });

  useEffect(() => {
    if (enabled) return;
    generation.current += 1;
    if (!keepPicture) replace(null);
  }, [enabled, keepPicture, replace]);

  useEffect(
    () => () => {
      generation.current += 1;
      replace(null);
    },
    [replace],
  );

  return picture;
}
