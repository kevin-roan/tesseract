import type { TheOneClient } from "@theone/client";
import { MotionGlobalConfig } from "motion/react";
import type { ReactElement } from "react";
import { vi, type Mock } from "vitest";
import type { TabHost } from "../../../../features/projects/hooks/use-tab-host";
import { renderRoutes } from "../../../../test/render";

MotionGlobalConfig.skipAnimations = true;

export type FakeClient = { baseUrl: string } & { [method: string]: Mock };

export function fakeConnection(): StreamConnectionStub {
  return { state: "open", close: vi.fn(), reconnect: vi.fn() };
}

interface StreamConnectionStub {
  state: "open";
  close: ReturnType<typeof vi.fn>;
  reconnect: ReturnType<typeof vi.fn>;
}

export function fakeClient(overrides: Partial<FakeClient> = {}): FakeClient {
  return {
    baseUrl: "http://100.64.0.1:7700",
    ports: vi.fn(async () => ({ tailscaleIp: null, ports: [] })),
    processLogs: vi.fn(async () => []),
    buildLogs: vi.fn(async () => []),
    getProcess: vi.fn(),
    getBuild: vi.fn(),
    openProcessLogs: vi.fn((_id: string, handlers: { onStateChange?(state: string): void }) => {
      handlers.onStateChange?.("open");
      return fakeConnection();
    }),
    openBuildLogs: vi.fn((_id: string, handlers: { onStateChange?(state: string): void }) => {
      handlers.onStateChange?.("open");
      return fakeConnection();
    }),
    stopProcess: vi.fn(),
    startProcess: vi.fn(),
    startBuild: vi.fn(),
    cancelBuild: vi.fn(),
    taildropTargets: vi.fn(async () => ({ available: false, targets: [] })),
    artifactDownloadUrl: vi.fn(async (id: string) => `http://100.64.0.1:7700/v1/artifacts/${id}/download?ticket=t`),
    deleteArtifact: vi.fn(),
    sendArtifactToTaildrop: vi.fn(),
    ...overrides,
  } as unknown as FakeClient;
}

export function asClient(client: FakeClient): TheOneClient {
  return client as unknown as TheOneClient;
}

export interface FakeHost extends TabHost {
  upsert: Mock<TabHost["upsert"]>;
  remove: Mock<TabHost["remove"]>;
  report: Mock<TabHost["report"]>;
}

export function fakeHost(projectId = "monolith"): FakeHost {
  return { projectId, visible: true, upsert: vi.fn<TabHost["upsert"]>(), remove: vi.fn<TabHost["remove"]>(), report: vi.fn<TabHost["report"]>() };
}

export function renderTab(element: ReactElement) {
  return renderRoutes([{ path: "*", element }], "/projects/monolith");
}
