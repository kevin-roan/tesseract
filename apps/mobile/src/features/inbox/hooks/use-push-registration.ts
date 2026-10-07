import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";

import { forgetPushRegistrations, registerPushToken, reportPushError } from "../api/push";
import { getExpoPushToken, subscribePushTokenChanges } from "../notifications";

export function usePushRegistration(): void {
  const sandboxes = useSandboxStore((state) => state.sandboxes);
  const tokens = useSandboxStore((state) => state.tokens);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [resumes, setResumes] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      getExpoPushToken().then((token) => {
        if (!cancelled && token) setPushToken(token);
      }, reportPushError);
    };
    refresh();
    const unsubscribe = subscribePushTokenChanges(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      forgetPushRegistrations();
      setResumes((count) => count + 1);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (pushToken) void registerPushToken(pushToken, sandboxes, tokens);
  }, [pushToken, sandboxes, tokens, resumes]);
}
