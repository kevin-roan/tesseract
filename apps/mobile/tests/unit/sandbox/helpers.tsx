import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Identity, ListeningPort } from "@tesseract/protocol";
import { sampleProcess, sampleProject } from "@tesseract/protocol/fixtures";

import { clearSandboxClients } from "@/features/sandbox/api/client";
import { useConnectionStore } from "@/features/sandbox/store/connection-store";
import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";
import type { PairedSandbox } from "@/features/sandbox/types";

import { __reset as resetSecureStore } from "../../mocks/expo-secure-store";
import { __reset as resetKvStore } from "../../mocks/expo-sqlite-kv-store";

export const TEST_SANDBOX: PairedSandbox = {
  id: "sbx_test",
  name: "Test box",
  baseUrl: "http://127.0.0.1:7700",
  addedAt: "2026-09-23T10:00:00.000Z",
};

export const TEST_TOKEN = "test-token-0123456789";

export const TEST_SITE: ListeningPort = {
  port: 5173,
  pid: 4242,
  command: "node vite",
  processId: sampleProcess.id,
  projectId: sampleProject.id,
  url: "http://100.116.96.29:5173",
  dnsUrl: "http://tesseract-sandbox.tail1234.ts.net:5173",
};

export const TEST_IDENTITY: Identity = {
  sandboxId: "tesseract-sandbox",
  tailscale: {
    available: true,
    source: "localapi",
    tailnet: "example.com",
    viewer: {
      id: "u1",
      loginName: "ada@example.com",
      displayName: "Ada Lovelace",
      profilePicUrl: "https://example.com/ada.png",
    },
    viewerNode: {
      hostName: "pixel",
      dnsName: "pixel.tail1234.ts.net.",
      os: "android",
      tailscaleIps: ["100.64.0.2"],
      online: true,
    },
    owner: { id: "u2", loginName: "grace@example.com", displayName: "Grace Hopper", profilePicUrl: null },
    node: {
      hostName: "tesseract-sandbox",
      dnsName: "tesseract-sandbox.tail1234.ts.net.",
      os: "linux",
      tailscaleIps: ["100.64.0.1"],
      online: true,
    },
  },
};

export const NO_TAILSCALE: Identity = {
  sandboxId: "tesseract-sandbox",
  tailscale: {
    available: false,
    source: "none",
    tailnet: null,
    viewer: null,
    viewerNode: null,
    owner: null,
    node: null,
  },
};

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
}

export function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

export function resetSandboxState(): void {
  useSandboxStore.setState({ sandboxes: [], activeId: null, tokens: {}, hydrated: false });
  useConnectionStore.setState({ links: {}, issues: {} });
  clearSandboxClients();
  resetSecureStore();
  resetKvStore();
}

export function seedActiveSandbox(sandbox: PairedSandbox = TEST_SANDBOX, token: string = TEST_TOKEN): void {
  useSandboxStore.setState({
    sandboxes: [sandbox],
    activeId: sandbox.id,
    tokens: { [sandbox.id]: token },
    hydrated: true,
  });
}

export type StreamHandlers = {
  onEvent?: (event: unknown) => void;
  onLine?: (line: unknown) => void;
  onBuild?: (build: unknown) => void;
  onRun?: (run: unknown) => void;
  onExit?: (code: number | null) => void;
  onStateChange?: (state: "connecting" | "open" | "closed") => void;
  onError?: (error: unknown) => void;
  onClose?: (info: { code: number; reason: string; willReconnect: boolean }) => void;
};

export function createFakeConnection() {
  return { state: "connecting" as "connecting" | "open" | "closed", close: jest.fn(), reconnect: jest.fn() };
}
