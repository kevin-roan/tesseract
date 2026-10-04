import { useCallback, useEffect, useReducer } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import type { PinKey } from "@/components/pin-pad";
import { playHaptic } from "@/lib/haptics";

import { hostKeys } from "../api/query-keys";
import { useHostSessionStore } from "../store/host-session-store";
import { describeHostError, isPinMissing, isPinRejected } from "../utils/errors";
import { EMPTY_PIN, isCompletePin, pinReducer } from "../utils/pin";
import { lockLine, lockedOutFor } from "../utils/session";
import { useHostClient } from "./use-host-client";
import { useNow } from "./use-now";

export function useHostUnlock(enabled: boolean) {
  const { host, client } = useHostClient();
  const start = useHostSessionStore((state) => state.start);
  const [pin, dispatch] = useReducer(pinReducer, EMPTY_PIN);

  const status = useQuery({
    queryKey: host ? hostKeys.lock(host.baseUrl) : hostKeys.root,
    queryFn: () => {
      if (!client) throw new Error("No host is paired.");
      return client.lockStatus();
    },
    enabled: enabled && client !== null,
    refetchOnMount: "always",
  });

  const now = useNow(enabled && Boolean(status.data?.lockedUntil));
  const lockedOut = lockedOutFor(status.data, now) > 0;
  const { refetch } = status;

  useEffect(() => {
    if (status.data?.lockedUntil && !lockedOut) void refetch();
  }, [status.data?.lockedUntil, lockedOut, refetch]);

  const unlock = useMutation({
    mutationFn: (digits: string) => {
      if (!client) throw new Error("No host is paired.");
      return client.unlock(digits);
    },
    onSuccess: (session) => {
      dispatch({ type: "clear" });
      playHaptic("success");
      start(session);
    },
    onError: () => {
      dispatch({ type: "reject" });
      playHaptic("error");
      void refetch();
    },
  });

  const { mutate, isPending } = unlock;
  const press = useCallback(
    (key: PinKey) => {
      if (isPending || lockedOut) return;
      if (key.kind === "digit") return dispatch({ type: "digit", digit: key.digit });
      if (key.kind === "delete") return dispatch({ type: "delete" });
      if (isCompletePin(pin.digits)) mutate(pin.digits);
    },
    [isPending, lockedOut, pin.digits, mutate],
  );

  const error = unlock.error ?? status.error;
  const message = unlock.error && isPinMissing(unlock.error) ? null : error && !isPinRejected(error) ? describeHostError(error) : null;

  return {
    pin,
    press,
    canSubmit: isCompletePin(pin.digits) && !lockedOut,
    submitting: isPending,
    disabled: lockedOut || status.data?.pinSet === false,
    line: lockLine(status.data, now),
    pinMissing: status.data?.pinSet === false || isPinMissing(unlock.error),
    rejectedMessage: isPinRejected(unlock.error) ? describeHostError(unlock.error) : null,
    statusError: status.error,
    message,
    retry: () => void refetch(),
  };
}
