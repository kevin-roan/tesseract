import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react-native";

import { useHostStore, selectWorkspaceId } from "@/features/host-shell/store/host-store";
import { folderName, gitSummary, isSameWorkspace } from "@/features/host-shell/utils/workspace";
import { SandboxScope } from "@/features/sandbox/hooks/sandbox-scope";
import { useSandboxClient } from "@/features/sandbox/hooks/use-sandbox-client";
import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";

import { __reset as resetSecure } from "../../mocks/expo-secure-store";
import { __reset as resetKv } from "../../mocks/expo-sqlite-kv-store";

const sandbox = (id: string, baseUrl = `http://${id}.ts.net`) => ({ id, name: id, baseUrl, addedAt: "2026-10-01T10:00:00.000Z" });
const ACCESS = { url: "http://100.64.0.1:7702", token: "ws", name: "pc (host)", projects: [] };

beforeEach(() => {
  resetSecure();
  resetKv();
  useSandboxStore.setState({ sandboxes: [sandbox("sbx_a")], activeId: "sbx_a", tokens: { sbx_a: "a" }, hydrated: true });
  useHostStore.setState({ hosts: {}, tokens: {}, workspaces: {}, hydrated: true });
});

describe("host workspace utils", () => {
  test("folderName and gitSummary", () => {
    expect(folderName("/home/me/streaxfit-monorepo/")).toBe("streaxfit-monorepo");
    expect(gitSummary("Updating 1..2\nFast-forward\n 2 files changed\n", "none")).toBe("2 files changed");
    expect(gitSummary("  \n", "Already up to date")).toBe("Already up to date");
  });

  test("isSameWorkspace compares the URL and the token", () => {
    expect(isSameWorkspace(sandbox("ws", ACCESS.url), "ws", ACCESS)).toBe(true);
    expect(isSameWorkspace(sandbox("ws", ACCESS.url), "old", ACCESS)).toBe(false);
    expect(isSameWorkspace(undefined, undefined, ACCESS)).toBe(false);
  });
});

describe("pairing the host workspace", () => {
  test("adds the workspace without switching the active sandbox and links it to that sandbox", async () => {
    const workspace = await useSandboxStore.getState().addSandbox({ name: ACCESS.name, baseUrl: ACCESS.url, token: ACCESS.token }, { activate: false });
    expect(useSandboxStore.getState().activeId).toBe("sbx_a");
    useHostStore.getState().linkWorkspace("sbx_a", workspace.id);
    expect(selectWorkspaceId(useHostStore.getState(), "sbx_a")).toBe(workspace.id);
    await useHostStore.getState().forget("sbx_a");
    expect(selectWorkspaceId(useHostStore.getState(), "sbx_a")).toBeNull();
  });

  test("SandboxScope points the screen's client at the workspace", async () => {
    useSandboxStore.setState({
      sandboxes: [sandbox("sbx_a"), sandbox("sbx_ws", ACCESS.url)],
      tokens: { sbx_a: "a", sbx_ws: "ws" },
    });
    const active = await renderHook(() => useSandboxClient());
    expect(active.result.current.client?.baseUrl).toBe("http://sbx_a.ts.net");
    const wrapper = ({ children }: { children: ReactNode }) => <SandboxScope id="sbx_ws">{children}</SandboxScope>;
    const scoped = await renderHook(() => useSandboxClient(), { wrapper });
    expect(scoped.result.current.sandbox?.id).toBe("sbx_ws");
    expect(scoped.result.current.client?.baseUrl).toBe(ACCESS.url);
  });
});
