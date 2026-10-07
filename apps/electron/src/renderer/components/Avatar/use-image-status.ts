import { useCallback, useEffect, useState } from "react";

export type ImageStatus = "none" | "loading" | "loaded" | "failed";

export function useImageStatus(src: string | null | undefined) {
  const [status, setStatus] = useState<ImageStatus>(src ? "loading" : "none");
  useEffect(() => setStatus(src ? "loading" : "none"), [src]);
  const onLoad = useCallback(() => setStatus("loaded"), []);
  const onError = useCallback(() => setStatus("failed"), []);
  return { status, onLoad, onError };
}
