import { useEffect } from "react";
import { AppState } from "react-native";

import { resumeTailnet } from "../services/tailnet";

const resume = () => {
  resumeTailnet().catch(() => undefined);
};

export function useTailnetLifecycle(): void {
  useEffect(() => {
    resume();
    let backgrounded = false;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "background") backgrounded = true;
      if (next === "active" && backgrounded) {
        backgrounded = false;
        resume();
      }
    });
    return () => subscription.remove();
  }, []);
}
