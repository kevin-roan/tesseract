import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ApiError, TesseractClient } from "@tesseract/client";
import type { LogLine, ProcessInfo, Project } from "@tesseract/protocol";
import { sampleProcess, sampleProject } from "@tesseract/protocol/fixtures";

import { sandboxKeys } from "@/features/sandbox/api/query-keys";
import { useNewProject } from "@/features/sandbox/hooks/use-new-project";

import {
  TEST_SANDBOX,
  createFakeConnection,
  createTestQueryClient,
  createWrapper,
  resetSandboxState,
  seedActiveSandbox,
  type StreamHandlers,
} from "../helpers";

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  dismissTo: jest.fn(),
  canGoBack: jest.fn(() => true),
};

jest.mock("@tesseract/client", () => ({ ...jest.requireActual("@tesseract/client"), TesseractClient: jest.fn() }));
jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  get router() {
    return mockRouter;
  },
}));

const MockClient = TesseractClient as unknown as jest.Mock;
const SID = TEST_SANDBOX.id;
const TS = "2026-09-23T10:00:00.000Z";
const NOTES: Project = { ...sampleProject, id: "notes", name: "notes", path: "/workspace/projects/notes", git: null, buildTargets: [] };
const CLONE_ID = "prc_clone00001";

let logHandlers: StreamHandlers;
let connections: ReturnType<typeof createFakeConnection>[];
const fake = {
  listProjects: jest.fn(),
  listProcesses: jest.fn(),
  createProject: jest.fn(),
  openProcessLogs: jest.fn((_id: string, next: StreamHandlers) => {
    logHandlers = next;
    const connection = createFakeConnection();
    connections.push(connection);
    return connection;
  }),
};

const projectRoute = (id: string) => ({ pathname: "/sandbox/projects/[id]", params: { id } });

async function renderNewProject(queryClient = createTestQueryClient()) {
  const rendered = await renderHook(() => useNewProject(), { wrapper: createWrapper(queryClient) });
  await waitFor(() => expect(fake.listProjects).toHaveBeenCalled());
  return { ...rendered, queryClient };
}

async function fill(result: { current: ReturnType<typeof useNewProject> }, values: Partial<Record<"name" | "gitUrl" | "branch", string>>) {
  await act(async () => {
    for (const [field, value] of Object.entries(values)) result.current.form.setField(field as "name", value);
  });
}

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  connections = [];
  Object.values(mockRouter).forEach((fn) => fn.mockClear());
  fake.listProjects.mockReset().mockResolvedValue([sampleProject]);
  fake.listProcesses.mockReset().mockResolvedValue([]);
  fake.createProject.mockReset();
  fake.openProcessLogs.mockClear();
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useNewProject", () => {
  it("validates the draft before calling the controller", async () => {
    const { result } = await renderNewProject();
    await waitFor(() => expect(result.current.form.draft.name).toBe(""));

    await act(async () => result.current.form.submit());
    expect(result.current.form.errors.name).toBe("Enter a project name.");

    await fill(result, { name: "Electron Hello", branch: "main" });
    await waitFor(() => expect(result.current.form.errors.name).toBeUndefined());
    await act(async () => result.current.form.submit());

    expect(result.current.form.errors.name).toBe("/workspace/projects/electron-hello already exists.");
    expect(result.current.form.errors.branch).toMatch(/Add a git URL/);
    expect(fake.createProject).not.toHaveBeenCalled();

    await fill(result, { branch: "" });
    expect(result.current.form.errors.branch).toBeUndefined();
    expect(result.current.form.errors.name).toBeDefined();
  });

  it("creates an empty project, caches it and opens it", async () => {
    fake.createProject.mockResolvedValue({ project: NOTES });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(sandboxKeys.projects(SID), [sampleProject]);
    const { result } = await renderNewProject(queryClient);

    await fill(result, { name: "  Notes  " });
    expect(result.current.form.submitLabel).toBe("Create project");
    expect(result.current.form.locationHint).toBe("Created as /workspace/projects/notes");
    await act(async () => result.current.form.submit());

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith(projectRoute("notes")));
    expect(fake.createProject).toHaveBeenCalledWith({ name: "Notes" });
    expect(queryClient.getQueryData(sandboxKeys.project(SID, "notes"))).toEqual(NOTES);
    expect(result.current.clone).toBeNull();
    expect(fake.openProcessLogs).not.toHaveBeenCalled();
  });

  it("follows the clone log and opens the project once git succeeds", async () => {
    fake.createProject.mockResolvedValue({ project: NOTES, processId: CLONE_ID });
    const { result } = await renderNewProject();

    await fill(result, { name: "notes", gitUrl: " https://github.com/me/notes.git ", branch: "dev" });
    expect(result.current.form.submitLabel).toBe("Clone project");
    await act(async () => result.current.form.submit());

    await waitFor(() => expect(result.current.clone?.processId).toBe(CLONE_ID));
    expect(fake.createProject).toHaveBeenCalledWith({ name: "notes", gitUrl: "https://github.com/me/notes.git", branch: "dev" });
    expect(fake.openProcessLogs).toHaveBeenCalledWith(CLONE_ID, expect.any(Object), expect.objectContaining({ reconnect: true }));
    expect(result.current.clone).toMatchObject({ projectId: "notes", gitUrl: "https://github.com/me/notes.git" });
    expect(result.current.clone?.badge).toEqual({ label: "Cloning", tone: "info" });

    const progress: LogLine = { seq: 1, ts: TS, stream: "stderr", text: "Receiving objects: 100%" };
    await act(async () => logHandlers.onLine?.(progress));
    await waitFor(() => expect(result.current.clone?.lines).toEqual([progress]));
    expect(mockRouter.replace).not.toHaveBeenCalled();

    await act(async () => logHandlers.onExit?.(0));
    expect(mockRouter.replace).toHaveBeenCalledWith(projectRoute("notes"));
  });

  it("stays on a failed clone and still offers the project folder", async () => {
    fake.createProject.mockResolvedValue({ project: NOTES, processId: CLONE_ID });
    const { result } = await renderNewProject();

    await fill(result, { name: "notes", gitUrl: "git@github.com:me/private.git" });
    await act(async () => result.current.form.submit());
    await waitFor(() => expect(result.current.clone).not.toBeNull());

    await act(async () => logHandlers.onExit?.(128));

    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(result.current.clone?.badge).toEqual({ label: "Failed", tone: "danger" });
    expect(result.current.clone?.failure).toMatch(/git exited with code 128/);

    await act(async () => result.current.clone?.openProject());
    expect(mockRouter.replace).toHaveBeenCalledWith(projectRoute("notes"));
  });

  it("falls back to the process list when the log stream never reports the exit", async () => {
    fake.createProject.mockResolvedValue({ project: NOTES, processId: CLONE_ID });
    const { result, queryClient } = await renderNewProject();
    await waitFor(() => expect(fake.listProcesses).toHaveBeenCalled());

    await fill(result, { name: "notes", gitUrl: "https://github.com/me/notes.git" });
    await act(async () => result.current.form.submit());
    await waitFor(() => expect(result.current.clone).not.toBeNull());

    const exited: ProcessInfo = { ...sampleProcess, id: CLONE_ID, projectId: "notes", state: "exited", exitCode: 0 };
    await act(async () => queryClient.setQueryData(sandboxKeys.processes(SID), [exited]));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith(projectRoute("notes")));
  });

  it("surfaces controller errors and keeps the form editable", async () => {
    fake.createProject.mockRejectedValue(new ApiError(409, "conflict", "Project notes already exists"));
    const { result } = await renderNewProject();

    await fill(result, { name: "notes" });
    await act(async () => result.current.form.submit());

    await waitFor(() => expect(result.current.form.error).toBe("Project notes already exists"));
    expect(result.current.form.submitting).toBe(false);
    expect(result.current.clone).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();

    await fill(result, { name: "notes-2" });
    expect(result.current.form.error).toBeNull();
  });
});
