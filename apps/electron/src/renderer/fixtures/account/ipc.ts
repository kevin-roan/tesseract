import type { AccountDevice } from "@tesseract/protocol";
import type { AccountState } from "../../../shared/contracts/account";
import type { HostTailnetState } from "../../../shared/contracts/tailnet";
import type { ServiceName } from "../../../shared/ipc";
import { currentScenario } from "../scenario";
import { defineIpcFixtures } from "../types";
import { ACCOUNT_SCENARIOS, FIXTURE_DEVICES, SIGNED_IN, SIGNED_OUT, TAILNET_RUNNING, TAILNET_SIGNED_OUT } from "./data";

let account: AccountState | null = null;
let devices: AccountDevice[] = [...FIXTURE_DEVICES];
let tailnet: HostTailnetState | null = null;

function emit(service: ServiceName, event: string, payload: unknown): void {
  void import("../registry").then(({ emitFixtureEvent }) => emitFixtureEvent(service, event, payload));
}

function accountState(): AccountState {
  account ??= currentScenario() === ACCOUNT_SCENARIOS.signedOut ? SIGNED_OUT : SIGNED_IN;
  return account;
}

function tailnetState(): HostTailnetState {
  tailnet ??= accountState().account ? TAILNET_RUNNING : TAILNET_SIGNED_OUT;
  return tailnet;
}

function setAccount(next: AccountState): AccountState {
  account = next;
  tailnet = null;
  emit("account", "state", next);
  emit("tailnet", "state", tailnetState());
  return next;
}

export function resetAccountFixture(): void {
  account = null;
  tailnet = null;
  devices = [...FIXTURE_DEVICES];
}

export const accountFixtures = defineIpcFixtures({
  account: {
    state: () => accountState(),
    setServer: (serverUrl) => setAccount({ ...SIGNED_OUT, serverUrl: serverUrl || null }),
    signIn: (email) => setAccount({ ...SIGNED_IN, account: { ...SIGNED_IN.account!, email } }),
    signUp: (email, _password, displayName) => setAccount({ ...SIGNED_IN, account: { ...SIGNED_IN.account!, email, displayName: displayName ?? null } }),
    signOut: () => setAccount(SIGNED_OUT),
    refresh: () => accountState(),
    devices: () => devices,
    removeDevice: (id) => {
      devices = devices.filter((device) => device.id !== id);
      return devices;
    },
    deleteAccount: () => setAccount(SIGNED_OUT),
  },
  tailnet: {
    state: () => tailnetState(),
    setMode: (mode) => {
      const on = Boolean(accountState().account) && mode !== "off";
      tailnet = on ? { ...TAILNET_RUNNING, mode } : { ...TAILNET_SIGNED_OUT, mode, status: accountState().account ? "off" : "signed-out" };
      emit("tailnet", "state", tailnet);
      return tailnet;
    },
    restart: () => tailnetState(),
  },
});

export default accountFixtures;
