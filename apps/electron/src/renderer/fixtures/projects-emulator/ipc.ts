import { defineIpcFixtures } from "../types";
import { hostAndroid, hostState } from "./data";

const SESSION_MS = 15 * 60_000;

export default defineIpcFixtures({
  hostShell: {
    state: () => hostState,
    refresh: () => hostState,
    unlock: () => Object.assign(hostState, { sessionExpiresAt: Date.now() + SESSION_MS }),
    lock: () => Object.assign(hostState, { sessionExpiresAt: null }),
    androidStatus: () => hostAndroid,
    stopEmulator: () => {
      hostAndroid.emulator = { ...hostAndroid.emulator, state: "stopped", serial: null };
      return hostAndroid;
    },
    startEmulator: (avd) => {
      hostAndroid.emulator = { ...hostAndroid.emulator, state: "running", avd, serial: "127.0.0.1:41555", isolated: true, startedAt: new Date().toISOString() };
      return hostAndroid;
    },
    linkSandbox: (sandboxUrl) => {
      hostAndroid.link = { configured: true, sandboxUrl, connected: true, lastError: null };
      return hostAndroid.link;
    },
    openEmulatorViewer: () => undefined,
  },
});
