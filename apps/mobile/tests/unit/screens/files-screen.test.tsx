import { fireEvent, render, screen } from "@testing-library/react-native";
import type { Artifact, BuildOutput } from "@theone/protocol";
import { sampleArtifact } from "@theone/protocol/fixtures";

import FilesScreen from "@/app/files";
import { FILES_VIEWS, SOURCE_FILTERS } from "@/features/files/utils/filters";

const mockFiles = jest.fn();

jest.mock("expo-router", () => ({ useIsFocused: () => true, useLocalSearchParams: () => ({}) }));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
jest.mock("@/features/files/hooks/use-files-screen", () => ({ useFilesScreen: () => mockFiles() }));

const shared: Artifact = { ...sampleArtifact, id: "art_apk", fileName: "notes.apk", source: "agent", buildId: null, note: "Try the new sync screen" };

const APK: BuildOutput = {
  projectId: "notes",
  path: "android/app/build/outputs/apk/release/app-release.apk",
  fileName: "app-release.apk",
  sizeBytes: 1024,
  platform: "android",
  modifiedAt: "2026-09-23T12:00:00.000Z",
};

function builds(overrides: object = {}) {
  return {
    outputs: [APK],
    total: 1,
    subtitle: "1 build",
    loading: false,
    error: null,
    retry: jest.fn(),
    projectOptions: [],
    projectId: "all",
    selectProject: jest.fn(),
    clearFilters: jest.fn(),
    download: jest.fn(),
    share: jest.fn(),
    localStatus: jest.fn(() => ({ downloaded: false, progress: undefined, sharing: false })),
    downloadError: null,
    ...overrides,
  };
}

function files(overrides: object = {}) {
  return {
    hydrated: true,
    paired: true,
    back: jest.fn(),
    pair: jest.fn(),
    files: [shared, sampleArtifact],
    total: 2,
    subtitle: "2 files",
    viewOptions: FILES_VIEWS,
    view: "shared",
    selectView: jest.fn(),
    builds: builds(),
    projectName: () => "Electron hello",
    loading: false,
    error: null,
    retry: jest.fn(),
    filtered: false,
    clearFilters: jest.fn(),
    sourceOptions: SOURCE_FILTERS.map(({ id, label }) => ({ id, label })),
    sourceId: "all",
    selectSource: jest.fn(),
    projectOptions: [],
    projectId: "all",
    selectProject: jest.fn(),
    download: jest.fn(),
    share: jest.fn(),
    localStatus: jest.fn(() => ({ downloaded: false, progress: undefined, sharing: false })),
    downloadError: null,
    remove: jest.fn(),
    deletingId: null,
    taildropAvailable: true,
    openTaildrop: jest.fn(),
    sendTo: jest.fn(),
    sharing: null,
    closeTaildrop: jest.fn(),
    targets: [],
    targetsLoading: false,
    sendingTargetId: null,
    sendError: null,
    sentMessage: null,
    actionError: null,
    refreshing: false,
    refresh: jest.fn(),
    ...overrides,
  };
}

describe("FilesScreen", () => {
  it("lists shared files and builds with their actions", async () => {
    const state = files();
    mockFiles.mockReturnValue(state);
    await render(<FilesScreen />);

    expect(screen.getByText("notes.apk")).toBeOnTheScreen();
    expect(screen.getByText("Try the new sync screen")).toBeOnTheScreen();
    expect(screen.getByLabelText("Shared")).toBeOnTheScreen();
    expect(screen.getByLabelText("Build")).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText("Download notes.apk"));
    expect(state.download).toHaveBeenCalledWith(shared);
    await fireEvent.press(screen.getByLabelText("Share notes.apk"));
    expect(state.share).toHaveBeenCalledWith(shared);
    await fireEvent.press(screen.getByLabelText("Send notes.apk with Taildrop"));
    expect(state.openTaildrop).toHaveBeenCalledWith(shared);
    await fireEvent.press(screen.getByLabelText("Delete notes.apk"));
    expect(state.remove).toHaveBeenCalledWith(shared);
    await fireEvent.press(screen.getByLabelText("Shared by Claude"));
    expect(state.selectSource).toHaveBeenCalledWith("agent");
  });

  it("switches to project builds and downloads one", async () => {
    const state = files();
    mockFiles.mockReturnValue(state);
    const { rerender } = await render(<FilesScreen />);
    await fireEvent.press(screen.getByLabelText("Project builds"));
    expect(state.selectView).toHaveBeenCalledWith("builds");

    const viewing = files({ view: "builds" });
    mockFiles.mockReturnValue(viewing);
    await rerender(<FilesScreen />);
    expect(screen.queryByText("notes.apk")).toBeNull();
    expect(screen.getByText("app-release.apk")).toBeOnTheScreen();
    expect(screen.getByText("android/app/build/outputs/apk/release")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Download app-release.apk"));
    expect(viewing.builds.download).toHaveBeenCalledWith(APK);
    await fireEvent.press(screen.getByLabelText("Share app-release.apk"));
    expect(viewing.builds.share).toHaveBeenCalledWith(APK);

    mockFiles.mockReturnValue(files({ view: "builds", builds: builds({ outputs: [], total: 0 }) }));
    await rerender(<FilesScreen />);
    expect(screen.getByText("No builds found")).toBeOnTheScreen();
  });

  it("shows download progress, then the saved state", async () => {
    const state = files({ localStatus: (artifact: Artifact) => ({ downloaded: false, progress: artifact.id === shared.id ? 0.42 : undefined, sharing: false }) });
    mockFiles.mockReturnValue(state);
    const { rerender } = await render(<FilesScreen />);
    expect(screen.getByText("42%")).toBeOnTheScreen();
    expect(screen.getByLabelText("Downloading notes.apk")).toBeOnTheScreen();

    const saved = files({ localStatus: () => ({ downloaded: true, progress: undefined, sharing: false }) });
    mockFiles.mockReturnValue(saved);
    await rerender(<FilesScreen />);
    expect(screen.getAllByText("Saved")).toHaveLength(2);
    await fireEvent.press(screen.getByLabelText("notes.apk is saved on this device"));
    expect(saved.download).not.toHaveBeenCalled();
  });

  it("hides Taildrop when the sandbox has no tailnet access", async () => {
    mockFiles.mockReturnValue(files({ taildropAvailable: false }));
    await render(<FilesScreen />);
    expect(screen.queryByLabelText("Send notes.apk with Taildrop")).toBeNull();
  });

  it("shows the empty, error and filtered-out states", async () => {
    mockFiles.mockReturnValue(files({ files: [], total: 0 }));
    const { rerender } = await render(<FilesScreen />);
    expect(screen.getByText("No files yet")).toBeOnTheScreen();

    const failing = files({ error: "Boom" });
    mockFiles.mockReturnValue(failing);
    await rerender(<FilesScreen />);
    expect(screen.getByText("Files are unavailable")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Retry"));
    expect(failing.retry).toHaveBeenCalled();

    const filtered = files({ files: [], filtered: true });
    mockFiles.mockReturnValue(filtered);
    await rerender(<FilesScreen />);
    expect(screen.getByText("No files match these filters.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Show all files"));
    expect(filtered.clearFilters).toHaveBeenCalled();
  });

  it("picks a Taildrop target from the sheet", async () => {
    const state = files({
      sharing: shared,
      targets: [
        { id: "n_mac", hostName: "mac", dnsName: null, os: "macOS", online: true },
        { id: "n_off", hostName: "old-laptop", dnsName: null, os: "windows", online: false },
      ],
    });
    mockFiles.mockReturnValue(state);
    await render(<FilesScreen />);
    expect(screen.getByText("Send with Taildrop")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("mac"));
    expect(state.sendTo).toHaveBeenCalledWith("n_mac");
    expect(screen.getByText("Windows · Offline")).toBeOnTheScreen();
  });
});
