import { Linking } from "react-native";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ApiError, TesseractClient } from "@tesseract/client";
import type { Artifact, BuildOutput, TaildropTargets } from "@tesseract/protocol";
import { sampleArtifact, sampleProject } from "@tesseract/protocol/fixtures";

import { useFileDownload } from "@/features/files/hooks/use-file-download";
import { useFilesScreen } from "@/features/files/hooks/use-files-screen";
import { MISSING_FILE_MESSAGE } from "@/features/files/utils/constants";
import * as mockFs from "../../mocks/expo-file-system";
import * as mockSharing from "../../mocks/expo-sharing";
import { sandboxKeys } from "@/features/sandbox/api/query-keys";
import { confirm } from "@/lib/confirm";

import { TEST_SANDBOX, createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../sandbox/helpers";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
let mockParams: Record<string, string> = {};

jest.mock("@tesseract/client", () => ({ ...jest.requireActual("@tesseract/client"), TesseractClient: jest.fn() }));
jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  useLocalSearchParams: () => mockParams,
  get router() {
    return mockRouter;
  },
}));
jest.mock("@/lib/confirm", () => ({ confirm: jest.fn() }));

const MockClient = TesseractClient as unknown as jest.Mock;
const mockConfirm = confirm as jest.Mock;
const SID = TEST_SANDBOX.id;

const shared: Artifact = {
  ...sampleArtifact,
  id: "art_apk",
  projectId: "notes",
  buildId: null,
  fileName: "notes.apk",
  source: "agent",
  note: "Debug build",
  createdAt: "2026-09-23T12:00:00.000Z",
};

const TARGETS: TaildropTargets = {
  available: true,
  targets: [
    { id: "n_off", hostName: "old-laptop", dnsName: null, os: "windows", online: false },
    { id: "n_mac", hostName: "mac", dnsName: "mac.tail.ts.net.", os: "macOS", online: true },
  ],
};

const APK: BuildOutput = {
  projectId: "notes",
  path: "android/app/build/outputs/apk/release/app-release.apk",
  fileName: "app-release.apk",
  sizeBytes: 1024,
  platform: "android",
  modifiedAt: "2026-09-23T12:00:00.000Z",
};
const SETUP: BuildOutput = {
  projectId: sampleProject.id,
  path: "release/build/Hello Setup 1.0.0.exe",
  fileName: "Hello Setup 1.0.0.exe",
  sizeBytes: 2048,
  platform: "windows",
  modifiedAt: "2026-09-23T11:00:00.000Z",
};

const fake = {
  listArtifacts: jest.fn(),
  listBuildOutputs: jest.fn(),
  buildOutputDownloadUrl: jest.fn(),
  listProjects: jest.fn(),
  artifactDownloadUrl: jest.fn(),
  deleteArtifact: jest.fn(),
  taildropTargets: jest.fn(),
  sendArtifactToTaildrop: jest.fn(),
};

let openURL: jest.SpyInstance;

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  mockParams = {};
  Object.values(mockRouter).forEach((fn) => fn.mockClear());
  mockConfirm.mockReset().mockResolvedValue(true);
  fake.listArtifacts.mockReset().mockResolvedValue([sampleArtifact, shared]);
  fake.listProjects.mockReset().mockResolvedValue([sampleProject]);
  fake.listBuildOutputs.mockReset().mockResolvedValue([APK, SETUP]);
  fake.buildOutputDownloadUrl.mockReset().mockImplementation(async (output: BuildOutput) => `http://sandbox/v1/projects/${output.projectId}/outputs/download?ticket=t`);
  fake.artifactDownloadUrl.mockReset().mockImplementation(async (id: string) => `http://sandbox/v1/artifacts/${id}/download?ticket=t`);
  fake.deleteArtifact.mockReset().mockImplementation(async (id: string) => ({ ...shared, id }));
  fake.taildropTargets.mockReset().mockResolvedValue(TARGETS);
  fake.sendArtifactToTaildrop.mockReset().mockResolvedValue(shared);
  MockClient.mockReset().mockImplementation(() => fake);
  openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  mockFs.__reset();
  mockSharing.shareAsync.mockClear();
});

afterEach(() => openURL.mockRestore());

describe("useFileDownload", () => {
  const savedUri = `file:///document/downloads/artifacts/${SID}/${shared.id}/notes.apk`;

  it("saves a file the sandbox still has into app storage", async () => {
    mockFs.__setDownload(shared.sizeBytes);
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(sandboxKeys.artifacts(SID), [shared]);
    const { result } = await renderHook(() => useFileDownload(), { wrapper: createWrapper(queryClient) });
    expect(result.current.status(shared)).toEqual({ downloaded: false, progress: undefined, sharing: false });

    await act(async () => result.current.download(shared));
    await waitFor(() => expect(result.current.status(shared).downloaded).toBe(true));
    expect(mockFs.downloads).toEqual([{ url: `http://sandbox/v1/artifacts/${shared.id}/download?ticket=t`, uri: savedUri }]);
    expect(fake.listArtifacts).not.toHaveBeenCalled();
    expect(openURL).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it("shares a saved file without downloading it again", async () => {
    mockFs.__setFile(savedUri, "", shared.sizeBytes);
    const { result } = await renderHook(() => useFileDownload(), { wrapper: createWrapper(createTestQueryClient()) });
    await act(async () => result.current.share(shared));
    await waitFor(() => expect(mockSharing.shareAsync).toHaveBeenCalledWith(savedUri, { dialogTitle: "notes.apk" }));
    expect(mockFs.downloads).toEqual([]);
  });

  it("ignores another share while the share sheet is open", async () => {
    mockFs.__setFile(savedUri, "", shared.sizeBytes);
    let close = () => {};
    mockSharing.shareAsync.mockImplementationOnce(() => new Promise<undefined>((resolve) => (close = () => resolve(undefined))));
    const { result } = await renderHook(() => useFileDownload(), { wrapper: createWrapper(createTestQueryClient()) });

    await act(async () => result.current.share(shared));
    await waitFor(() => expect(result.current.status(shared).sharing).toBe(true));
    await act(async () => result.current.share(shared));
    expect(mockSharing.shareAsync).toHaveBeenCalledTimes(1);

    await act(async () => close());
    await waitFor(() => expect(result.current.status(shared).sharing).toBe(false));
    await act(async () => result.current.share(shared));
    await waitFor(() => expect(mockSharing.shareAsync).toHaveBeenCalledTimes(2));
  });

  it("downloads a file before sharing it", async () => {
    mockFs.__setDownload(shared.sizeBytes);
    const { result } = await renderHook(() => useFileDownload(), { wrapper: createWrapper(createTestQueryClient()) });
    await act(async () => result.current.share(shared));
    await waitFor(() => expect(mockSharing.shareAsync).toHaveBeenCalledWith(savedUri, { dialogTitle: "notes.apk" }));
    expect(mockFs.downloads).toHaveLength(1);
    expect(result.current.status(shared)).toEqual({ downloaded: true, progress: undefined, sharing: false });
  });

  it("re-downloads a partial copy", async () => {
    mockFs.__setFile(savedUri, "", 1);
    mockFs.__setDownload(shared.sizeBytes);
    const { result } = await renderHook(() => useFileDownload(), { wrapper: createWrapper(createTestQueryClient()) });
    expect(result.current.status(shared).downloaded).toBe(false);
    await act(async () => result.current.download(shared));
    await waitFor(() => expect(result.current.status(shared).downloaded).toBe(true));
  });

  it("removes a failed download and reports why", async () => {
    mockFs.__setDownload(null, new Error("Connection reset"));
    const { result } = await renderHook(() => useFileDownload(), { wrapper: createWrapper(createTestQueryClient()) });
    await act(async () => result.current.download(shared));
    await waitFor(() => expect(result.current.error).toBe("Connection reset"));
    expect(result.current.status(shared)).toEqual({ downloaded: false, progress: undefined, sharing: false });
    expect(mockSharing.shareAsync).not.toHaveBeenCalled();
  });

  it("checks the sandbox before downloading an unknown file and explains when it was deleted", async () => {
    fake.listArtifacts.mockResolvedValue([sampleArtifact]);
    const queryClient = createTestQueryClient();
    const { result } = await renderHook(() => useFileDownload(), { wrapper: createWrapper(queryClient) });

    await act(async () => result.current.download({ ...shared, id: "art_gone" }));
    await waitFor(() => expect(result.current.error).toBe(MISSING_FILE_MESSAGE));
    expect(fake.listArtifacts).toHaveBeenCalledTimes(1);
    expect(fake.artifactDownloadUrl).not.toHaveBeenCalled();
    expect(mockFs.downloads).toEqual([]);
  });

  it("treats a 404 from the controller as a deleted file", async () => {
    fake.artifactDownloadUrl.mockRejectedValue(new ApiError(404, "not_found", "Unknown artifact"));
    const { result } = await renderHook(() => useFileDownload(), { wrapper: createWrapper(createTestQueryClient()) });
    await act(async () => result.current.download(shared));
    await waitFor(() => expect(result.current.error).toBe(MISSING_FILE_MESSAGE));
  });
});

async function renderScreen() {
  const queryClient = createTestQueryClient();
  const rendered = await renderHook(() => useFilesScreen(), { wrapper: createWrapper(queryClient) });
  await waitFor(() => expect(rendered.result.current.total).toBe(2));
  await waitFor(() => expect(rendered.result.current.taildropAvailable).toBe(true));
  return { ...rendered, queryClient };
}

describe("useFilesScreen", () => {
  it("lists every file newest first and filters by source and project", async () => {
    const { result } = await renderScreen();
    expect(result.current.files.map((file) => file.id)).toEqual([shared.id, sampleArtifact.id]);
    expect(result.current.subtitle).toBe("2 files");
    expect(result.current.projectName(sampleProject.id)).toBe(sampleProject.name);
    expect(result.current.projectOptions.map((option) => option.id)).toEqual(["all", sampleProject.id, "notes"]);

    await act(async () => result.current.selectSource("agent"));
    expect(result.current.files).toEqual([shared]);
    expect(result.current.subtitle).toBe("1 of 2 files");
    expect(result.current.filtered).toBe(true);

    await act(async () => result.current.selectSource("build"));
    await act(async () => result.current.selectProject("notes"));
    expect(result.current.files).toEqual([]);

    await act(async () => result.current.clearFilters());
    expect(result.current.files).toHaveLength(2);
    expect(result.current.projectId).toBe("all");
  });

  it("loads project builds only once that view is open, then filters and downloads them", async () => {
    const { result } = await renderScreen();
    expect(fake.listBuildOutputs).not.toHaveBeenCalled();

    await act(async () => result.current.selectView("builds"));
    await waitFor(() => expect(result.current.builds.total).toBe(2));
    expect(result.current.subtitle).toBe("2 builds");
    expect(result.current.builds.projectOptions.map((option) => option.id)).toEqual(["all", sampleProject.id, "notes"]);

    await act(async () => result.current.builds.selectProject("notes"));
    expect(result.current.builds.outputs).toEqual([APK]);
    expect(result.current.subtitle).toBe("1 of 2 builds");

    mockFs.__setDownload(APK.sizeBytes);
    await act(async () => result.current.builds.download(APK));
    await waitFor(() => expect(result.current.builds.localStatus(APK).downloaded).toBe(true));
    expect(fake.buildOutputDownloadUrl).toHaveBeenCalledWith(APK);
    expect(mockFs.downloads).toEqual([
      {
        url: "http://sandbox/v1/projects/notes/outputs/download?ticket=t",
        uri: `file:///document/downloads/builds/${SID}/notes_android_app_build_outputs_apk_release_app-release.apk/${Date.parse(APK.modifiedAt)}/app-release.apk`,
      },
    ]);
  });

  it("deletes a file only after confirmation", async () => {
    const { result, queryClient } = await renderScreen();

    mockConfirm.mockResolvedValueOnce(false);
    await act(async () => result.current.remove(shared));
    expect(fake.deleteArtifact).not.toHaveBeenCalled();

    await act(async () => result.current.remove(shared));
    await waitFor(() => expect(fake.deleteArtifact).toHaveBeenCalledWith(shared.id));
    expect(mockConfirm).toHaveBeenLastCalledWith(expect.objectContaining({ destructive: true, confirmLabel: "Delete" }));
    await waitFor(() => expect(result.current.files.map((file) => file.id)).toEqual([sampleArtifact.id]));
    expect(queryClient.getQueryData<Artifact[]>(sandboxKeys.artifacts(SID))).toEqual([sampleArtifact]);
  });

  it("sends a file to an online tailnet device with Taildrop", async () => {
    const { result } = await renderScreen();
    expect(result.current.targets.map((target) => target.id)).toEqual(["n_mac", "n_off"]);

    await act(async () => result.current.openTaildrop(shared));
    expect(result.current.sharing).toEqual(shared);

    await act(async () => result.current.sendTo("n_mac"));
    await waitFor(() => expect(result.current.sharing).toBeNull());
    expect(fake.sendArtifactToTaildrop).toHaveBeenCalledWith(shared.id, { targetId: "n_mac" }, expect.anything());
    expect(result.current.sentMessage).toBe("Sent notes.apk to mac");
  });

  it("keeps the sheet open and shows why a Taildrop send failed", async () => {
    fake.sendArtifactToTaildrop.mockRejectedValue(new ApiError(502, "internal", "mac refused the file"));
    const { result } = await renderScreen();
    await act(async () => result.current.openTaildrop(shared));
    await act(async () => result.current.sendTo("n_mac"));
    await waitFor(() => expect(result.current.sendError).toBe("mac refused the file"));
    expect(result.current.sharing).toEqual(shared);
    expect(result.current.actionError).toBeNull();
  });

  it("hides Taildrop when the sandbox cannot reach the tailnet", async () => {
    fake.taildropTargets.mockResolvedValue({ available: false, targets: [] });
    const { result } = await renderHook(() => useFilesScreen(), { wrapper: createWrapper(createTestQueryClient()) });
    await waitFor(() => expect(result.current.total).toBe(2));
    await waitFor(() => expect(fake.taildropTargets).toHaveBeenCalled());
    expect(result.current.taildropAvailable).toBe(false);
  });

  it("downloads the file a notification pointed at once", async () => {
    mockParams = { download: shared.id };
    mockFs.__setDownload(shared.sizeBytes);
    const { result, rerender } = await renderScreen();
    await waitFor(() => expect(result.current.localStatus(shared).downloaded).toBe(true));
    await rerender({});
    expect(mockFs.downloads).toHaveLength(1);
  });

  it("reports a failing file list and retries", async () => {
    fake.listArtifacts.mockRejectedValue(new ApiError(500, "internal", "Boom"));
    const { result } = await renderHook(() => useFilesScreen(), { wrapper: createWrapper(createTestQueryClient()) });
    await waitFor(() => expect(result.current.error).toBe("Boom"));
    fake.listArtifacts.mockResolvedValue([shared]);
    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.files).toEqual([shared]);
  });
});
