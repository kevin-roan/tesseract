import { Linking } from "react-native";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { TheOneClient } from "@theone/client";
import { sampleBuild } from "@theone/protocol/fixtures";

import { useArtifactDownload } from "@/features/sandbox/hooks/use-artifact-download";
import { useBuildDetail } from "@/features/sandbox/hooks/use-build-detail";
import type { LogStream } from "@/features/sandbox/hooks/use-log-stream";
import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";
import { buildMeta } from "@/features/sandbox/utils/describe";
import { buildTargetLabel } from "@/features/sandbox/utils/labels";
import { confirm } from "@/lib/confirm";

import { createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../helpers";

let mockLogs: LogStream;

jest.mock("@theone/client", () => ({ ...jest.requireActual("@theone/client"), TheOneClient: jest.fn() }));
jest.mock("expo-router", () => ({ useIsFocused: () => true, router: {} }));
jest.mock("@/lib/confirm", () => ({ confirm: jest.fn() }));
jest.mock("@/features/sandbox/hooks/use-log-stream", () => ({ useLogStream: () => mockLogs }));

const MockClient = TheOneClient as unknown as jest.Mock;
const mockConfirm = confirm as jest.Mock;
const fake = { getBuild: jest.fn(), cancelBuild: jest.fn(), artifactDownloadUrl: jest.fn() };
const running = { ...sampleBuild, state: "running" as const, stage: "compile" as const, endedAt: null };
const wrapper = () => createWrapper(createTestQueryClient());

let openURL: jest.SpyInstance;

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  mockConfirm.mockReset().mockResolvedValue(true);
  fake.getBuild.mockReset().mockResolvedValue(running);
  fake.cancelBuild.mockReset().mockResolvedValue({ ...running, state: "cancelled" });
  fake.artifactDownloadUrl.mockReset().mockImplementation(async (id: string) => `http://127.0.0.1:7700/v1/artifacts/${id}?ticket=t`);
  MockClient.mockReset().mockImplementation(() => fake);
  mockLogs = { lines: [], state: "open", exitCode: null, error: null, reconnect: jest.fn() } as unknown as LogStream;
  openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
});

afterEach(() => openURL.mockRestore());

describe("useBuildDetail", () => {
  it("shows a placeholder title until the build loads", async () => {
    fake.getBuild.mockReturnValue(new Promise(() => undefined));
    const { result } = await renderHook(() => useBuildDetail(sampleBuild.id), { wrapper: wrapper() });

    expect(result.current.title).toBe("Build");
    expect(result.current.subtitle).toBeUndefined();
    expect(result.current.meta).toBeUndefined();
    expect(result.current.badge).toBeUndefined();
    expect(result.current.active).toBe(false);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.headerActions[0]).toMatchObject({ id: "reconnect", label: "Reload logs" });
  });

  it("describes an active build and cancels it after confirmation", async () => {
    const { result } = await renderHook(() => useBuildDetail(sampleBuild.id), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.build).toBeDefined());

    expect(result.current.title).toBe(buildTargetLabel(sampleBuild.target));
    expect(result.current.subtitle).toContain(sampleBuild.projectId);
    expect(result.current.meta).toContain("Compile");
    expect(result.current.badge).toEqual({ label: "Running", tone: "info" });
    expect(result.current.active).toBe(true);
    expect(result.current.headerActions[0]).toMatchObject({ id: "cancel", label: "Cancel build", disabled: false });

    mockConfirm.mockResolvedValueOnce(false);
    await act(async () => result.current.headerActions[0].onPress());
    expect(fake.cancelBuild).not.toHaveBeenCalled();

    await act(async () => result.current.headerActions[0].onPress());
    await waitFor(() => expect(fake.cancelBuild).toHaveBeenCalledWith(sampleBuild.id));
    await waitFor(() => expect(result.current.active).toBe(false));
    expect(result.current.badge).toEqual({ label: "Cancelled", tone: "warning" });
  });

  it("reloads logs for a finished build and surfaces errors", async () => {
    fake.getBuild.mockResolvedValue(sampleBuild);
    const { result } = await renderHook(() => useBuildDetail(sampleBuild.id), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.build).toBeDefined());

    expect(result.current.meta).toBe(buildMeta(sampleBuild));
    result.current.headerActions[0].onPress();
    expect(mockLogs.reconnect).toHaveBeenCalled();

    fake.getBuild.mockRejectedValue(new Error("vanished"));
    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current.error).toBe("vanished"));
  });

  it("reports a failed cancel", async () => {
    fake.cancelBuild.mockRejectedValue(new Error("already finished"));
    const { result } = await renderHook(() => useBuildDetail(sampleBuild.id), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.active).toBe(true));
    await act(async () => result.current.headerActions[0].onPress());
    await waitFor(() => expect(result.current.cancelError).toBe("already finished"));
  });
});

describe("useArtifactDownload", () => {
  it("opens a ticketed download URL and tracks the pending artifact", async () => {
    let finish: () => void = () => undefined;
    openURL.mockImplementation(() => new Promise<true>((resolve) => (finish = () => resolve(true))));
    const { result } = await renderHook(() => useArtifactDownload(), { wrapper: wrapper() });

    expect(result.current.pendingId).toBeNull();
    await act(async () => result.current.download("art_1"));
    await waitFor(() => expect(result.current.pendingId).toBe("art_1"));
    expect(openURL).toHaveBeenCalledWith("http://127.0.0.1:7700/v1/artifacts/art_1?ticket=t");

    await act(async () => finish());
    await waitFor(() => expect(result.current.pendingId).toBeNull());
    expect(result.current.error).toBeNull();
  });

  it("reports a download that cannot start", async () => {
    fake.artifactDownloadUrl.mockRejectedValue(new Error("ticket refused"));
    const { result } = await renderHook(() => useArtifactDownload(), { wrapper: wrapper() });
    await act(async () => result.current.download("art_1"));
    await waitFor(() => expect(result.current.error).toBe("ticket refused"));
    expect(openURL).not.toHaveBeenCalled();
  });

  it("refuses without a paired sandbox", async () => {
    useSandboxStore.setState({ sandboxes: [], activeId: null, tokens: {} });
    const { result } = await renderHook(() => useArtifactDownload(), { wrapper: wrapper() });
    await act(async () => result.current.download("art_1"));
    await waitFor(() => expect(result.current.error).toBe("No sandbox is paired."));
  });
});
