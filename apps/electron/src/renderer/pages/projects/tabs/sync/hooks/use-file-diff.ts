import type { SyncFileChange } from "@tesseract/protocol";
import { useEffect, useRef, useState } from "react";
import { describeError } from "../../../../../app/connection";
import { ipc } from "../../../../../lib/ipc";
import { tooLarge, type DiffResult } from "../review/model";

const LOADING: DiffResult = { status: "loading" };

export function useFileDiff(projectId: string, change: SyncFileChange | null): DiffResult | null {
  const cache = useRef(new Map<string, DiffResult>());
  const [loaded, setLoaded] = useState<{ path: string; result: DiffResult } | null>(null);
  const path = change?.path ?? null;
  const skip = change === null || tooLarge(change);

  useEffect(() => {
    if (path === null || skip || cache.current.has(path)) return;
    let current = true;
    ipc.syncback
      .diff(projectId, path)
      .then(
        (diff): DiffResult => ({ status: "ready", diff }),
        (error: unknown): DiffResult => ({ status: "error", message: describeError(error) }),
      )
      .then((result) => {
        cache.current.set(path, result);
        if (current) setLoaded({ path, result });
      });
    return () => {
      current = false;
    };
  }, [projectId, path, skip]);

  if (path === null) return null;
  if (skip) return LOADING;
  const cached = cache.current.get(path);
  if (cached) return cached;
  return loaded?.path === path ? loaded.result : LOADING;
}
