import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, type TesseractClient } from "@tesseract/client";
import type { HostToolchain, UpdateHostToolchain } from "@tesseract/protocol";
import { useCallback, useMemo } from "react";
import { HOST_TOOLCHAIN_KEY } from "../constants";
import { REMOTE_ANDROID_LABELS as L } from "./labels";

/** A host daemon from before this route answers 404 "No route". */
function message(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) return L.outdated;
  return error instanceof Error ? error.message : String(error);
}

/** The connected host's Android SDK and JDK (`/v1/android/toolchain` through the host proxy). */
export function useHostToolchain(client: TesseractClient | null, hostUrl: string | null) {
  const queryClient = useQueryClient();
  const key = useMemo(() => [...HOST_TOOLCHAIN_KEY, hostUrl ?? ""], [hostUrl]);
  const query = useQuery({
    queryKey: key,
    queryFn: () => (client as TesseractClient).hostToolchain(),
    enabled: client !== null,
    retry: false,
  });
  const update = useMutation({
    mutationFn: (body: UpdateHostToolchain) => (client as TesseractClient).updateHostToolchain(body),
    onSuccess: (toolchain: HostToolchain) => queryClient.setQueryData(key, toolchain),
  });
  const { refetch } = query;
  return {
    toolchain: query.data ?? null,
    loading: query.isPending && client !== null,
    error: query.error ? message(query.error) : null,
    refresh: useCallback(() => void refetch(), [refetch]),
    save: update.mutateAsync,
    saving: update.isPending,
  };
}
