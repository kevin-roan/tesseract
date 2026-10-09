import { act, renderHook, waitFor } from "@testing-library/react-native";
import { TesseractClient } from "@tesseract/client";
import type { ProjectDirectory, ProjectFile, TaildropTargets } from "@tesseract/protocol";
import { sampleProject } from "@tesseract/protocol/fixtures";

import { useProjectFilesScreen } from "@/features/files/hooks/use-project-files-screen";
import { breadcrumbs, directorySubtitle, parentPath, projectFileSubtitle } from "@/features/files/utils/project-files";
import * as mockFs from "../../mocks/expo-file-system";
import * as mockSharing from "../../mocks/expo-sharing";

import { TEST_SANDBOX, createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../sandbox/helpers";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };

jest.mock("@tesseract/client", () => ({ ...jest.requireActual("@tesseract/client"), TesseractClient: jest.fn() }));
jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  get router() {
    return mockRouter;
  },
}));

const MockClient = TesseractClient as unknown as jest.Mock;
const PID = sampleProject.id;

const README: ProjectFile = { name: "README.md", path: "README.md", kind: "file", sizeBytes: 2048, modifiedAt: "2026-10-09T09:00:00.000Z" };
const SRC: ProjectFile = { name: "src", path: "src", kind: "dir", sizeBytes: null, modifiedAt: "2026-10-09T09:00:00.000Z" };
const MAIN: ProjectFile = { name: "main.ts", path: "src/main.ts", kind: "file", sizeBytes: 10, modifiedAt: "2026-10-09T09:00:00.000Z" };

const directory = (path: string, entries: ProjectFile[]): ProjectDirectory => ({ projectId: PID, path, entries, truncated: false });

const TARGETS: TaildropTargets = {
  available: true,
  targets: [{ id: "n_mac", hostName: "mac", dnsName: null, os: "macOS", online: true }],
};

const fake = {
  getProject: jest.fn(),
  listProjectFiles: jest.fn(),
  projectFileDownloadUrl: jest.fn(),
  taildropTargets: jest.fn(),
  sendProjectFileToTaildrop: jest.fn(),
};

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  Object.values(mockRouter).forEach((fn) => fn.mockClear());
  fake.getProject.mockReset().mockResolvedValue(sampleProject);
  fake.listProjectFiles.mockReset().mockImplementation(async (_id: string, path: string) =>
    path === "src" ? directory("src", [MAIN]) : directory("", [SRC, README]),
  );
  fake.projectFileDownloadUrl.mockReset().mockImplementation(async (id: string, path: string) => `http://sandbox/v1/projects/${id}/files/download?path=${path}&ticket=t`);
  fake.taildropTargets.mockReset().mockResolvedValue(TARGETS);
  fake.sendProjectFileToTaildrop.mockReset().mockResolvedValue(README);
  MockClient.mockReset().mockImplementation(() => fake);
  mockFs.__reset();
  mockSharing.shareAsync.mockClear();
});

async function renderScreen() {
  const rendered = await renderHook(() => useProjectFilesScreen(PID), { wrapper: createWrapper(createTestQueryClient()) });
  await waitFor(() => expect(rendered.result.current.entries).toHaveLength(2));
  return rendered;
}

describe("useProjectFilesScreen", () => {
  it("lists the root and opens folders, going back up before leaving", async () => {
    const { result } = await renderScreen();
    expect(result.current.crumbs.map((crumb) => crumb.id)).toEqual([""]);
    expect(result.current.summary).toBe("1 folder · 1 file");

    await act(async () => result.current.open("src"));
    await waitFor(() => expect(result.current.entries).toEqual([MAIN]));
    expect(fake.listProjectFiles).toHaveBeenCalledWith(PID, "src", expect.anything());
    expect(result.current.title).toBe("src");

    await act(async () => result.current.back());
    await waitFor(() => expect(result.current.path).toBe(""));
    expect(mockRouter.back).not.toHaveBeenCalled();
    await act(async () => result.current.back());
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("saves a file and hands it to the share sheet", async () => {
    mockFs.__setDownload(README.sizeBytes!);
    const { result } = await renderScreen();
    await act(async () => result.current.share(README));
    await waitFor(() => expect(mockSharing.shareAsync).toHaveBeenCalledWith(expect.stringContaining("/README.md"), { dialogTitle: "README.md" }));
    expect(fake.projectFileDownloadUrl).toHaveBeenCalledWith(PID, "README.md");
    expect(mockFs.downloads[0]!.uri).toContain(`/projects/${TEST_SANDBOX.id}/${PID}/`);
    expect(result.current.localStatus(README).downloaded).toBe(true);
  });

  it("sends a file with Taildrop", async () => {
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.taildropAvailable).toBe(true));
    await act(async () => result.current.openTaildrop(README));
    expect(result.current.sharing).toEqual(README);
    await act(async () => result.current.sendTo("n_mac"));
    await waitFor(() => expect(result.current.sharing).toBeNull());
    expect(fake.sendProjectFileToTaildrop).toHaveBeenCalledWith(PID, { path: "README.md", targetId: "n_mac" }, expect.anything());
    await waitFor(() => expect(result.current.sentMessage).toBe("Sent README.md to mac"));
  });
});

describe("project file utils", () => {
  it("builds breadcrumbs and parent paths", () => {
    expect(breadcrumbs("src/app/screens", "Notes")).toEqual([
      { id: "", label: "Notes" },
      { id: "src", label: "src" },
      { id: "src/app", label: "app" },
      { id: "src/app/screens", label: "screens" },
    ]);
    expect(parentPath("")).toBeNull();
    expect(parentPath("src")).toBe("");
    expect(parentPath("src/app")).toBe("src");
  });

  it("describes files and folders", () => {
    const now = Date.parse("2026-10-09T10:00:00.000Z");
    expect(projectFileSubtitle(README, now)).toBe("2 KB · 1h ago");
    expect(projectFileSubtitle({ ...SRC, modifiedAt: null }, now)).toBe("");
    expect(directorySubtitle(directory("", []))).toBeUndefined();
    expect(directorySubtitle(directory("", [SRC, README, MAIN]))).toBe("1 folder · 2 files");
  });
});
