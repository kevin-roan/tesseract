import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { ipc } from "../../../../lib/ipc";
import { ABOUT_KEYS } from "../constants";

export function useAppPaths() {
  const query = useQuery({ queryKey: ABOUT_KEYS.paths, queryFn: () => ipc.app.paths(), staleTime: Number.POSITIVE_INFINITY, retry: false });
  const reveal = useCallback((path: string) => {
    ipc.app.showItemInFolder(path).catch(() => undefined);
  }, []);
  return { paths: query.data ?? null, reveal };
}
