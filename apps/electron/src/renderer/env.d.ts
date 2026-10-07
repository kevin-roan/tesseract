import type { MonolithBridge } from "../shared/ipc";

declare global {
  interface Window {
    monolith?: MonolithBridge;
    __monolithIdle?: () => Promise<boolean>;
  }
}

export {};
