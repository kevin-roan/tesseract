import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { onlineManager, useQueryClient } from "@tanstack/react-query";

import { applyServerEvent, resyncSandbox } from "../api/cache";
import { useConnectionStore } from "../store/connection-store";
import type { SandboxIssue, SandboxLink } from "../types";
import { issueForError } from "../utils/errors";
import { useSandboxClient } from "./use-sandbox-client";

export function useSandboxLink(): SandboxLink {
  const { sandbox, client } = useSandboxClient();
  return useConnectionStore((state) => (sandbox && client ? (state.links[sandbox.id] ?? "connecting") : "idle"));
}

export function useSandboxIssue(): SandboxIssue | null {
  const { sandbox } = useSandboxClient();
  return useConnectionStore((state) => (sandbox ? (state.issues[sandbox.id] ?? null) : null));
}

/**
 * One events socket for the active sandbox. The client already reconnects with
 * backoff after abnormal closes; this also skips the wait when the app returns
 * to the foreground or the network comes back, and opens a fresh socket if the
 * previous one gave up for good (for example after a rejected ticket).
 * A rejected token or a protocol version mismatch is recorded as the sandbox's
 * issue so the hub can ask for a new pairing; a successful handshake clears it.
 */
export function useSandboxEvents(): SandboxLink {
  const { sandbox, client } = useSandboxClient();
  const queryClient = useQueryClient();
  const setLink = useConnectionStore((state) => state.setLink);
  const setIssue = useConnectionStore((state) => state.setIssue);
  const sandboxId = sandbox?.id ?? null;
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!sandboxId || !client) return;
    const connection = client.openEvents({
      onEvent: (event) => {
        if (event.type === "hello") {
          setIssue(sandboxId, null);
          void resyncSandbox(queryClient, sandboxId);
        } else applyServerEvent(queryClient, sandboxId, event);
      },
      onError: (error) => {
        const issue = issueForError(error);
        if (issue) setIssue(sandboxId, issue);
      },
      onStateChange: (state) => setLink(sandboxId, state),
    });
    const revive = () => {
      if (connection.state === "closed") setGeneration((value) => value + 1);
      else if (connection.state !== "open") connection.reconnect();
    };
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") revive();
    });
    const unsubscribeOnline = onlineManager.subscribe((online) => {
      if (online) revive();
    });
    return () => {
      appState.remove();
      unsubscribeOnline();
      connection.close();
    };
  }, [sandboxId, client, queryClient, setLink, setIssue, generation]);

  return useSandboxLink();
}
