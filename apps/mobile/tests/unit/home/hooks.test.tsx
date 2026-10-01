import { act, renderHook, waitFor } from "@testing-library/react-native";
import { TheOneClient } from "@theone/client";
import {
  sampleAgentRun,
  sampleBuild,
  sampleClaudeSession,
  sampleIdentity,
  sampleInbox,
  sampleProject,
  sampleUsageReport,
} from "@theone/protocol/fixtures";

import { useChatsScreen } from "@/features/chats/hooks/use-chats-screen";
import { useResumeChat } from "@/features/chats/hooks/use-resume-chat";
import { useHomeScreen } from "@/features/home/hooks/use-home-screen";
import { useUsage } from "@/features/home/hooks/use-usage";

import { createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../sandbox/helpers";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => true) };

jest.mock("@theone/client", () => ({ ...jest.requireActual("@theone/client"), TheOneClient: jest.fn() }));
jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  get router() {
    return mockRouter;
  },
}));

const MockClient = TheOneClient as unknown as jest.Mock;
const fake = {
  usage: jest.fn(),
  sessions: jest.fn(),
  inbox: jest.fn(),
  listProjects: jest.fn(),
  identity: jest.fn(),
  startAgentRun: jest.fn(),
  listBuilds: jest.fn(),
};

const runningBuild = { ...sampleBuild, state: "running" as const, stage: "compile", progress: 0.42, endedAt: null };

const wrapper = () => ({ wrapper: createWrapper(createTestQueryClient()) });

async function renderHome() {
  const rendered = await renderHook(() => useHomeScreen(), wrapper());
  await waitFor(() => expect(rendered.result.current.inbox.unreadCount).toBe(sampleInbox.unreadCount));
  return rendered;
}

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  Object.values(mockRouter).forEach((fn) => fn.mockClear());
  fake.usage.mockReset().mockResolvedValue(sampleUsageReport);
  fake.sessions.mockReset().mockResolvedValue([sampleClaudeSession]);
  fake.inbox.mockReset().mockResolvedValue(sampleInbox);
  fake.listProjects.mockReset().mockResolvedValue([sampleProject]);
  fake.identity.mockReset().mockResolvedValue(sampleIdentity);
  fake.startAgentRun.mockReset().mockResolvedValue({ ...sampleAgentRun, id: "run_resumed" });
  fake.listBuilds.mockReset().mockResolvedValue([sampleBuild]);
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useUsage", () => {
  it("asks the controller for the selected range", async () => {
    const { result } = await renderHook(() => useUsage(30), wrapper());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fake.usage).toHaveBeenCalledWith({ days: 30 }, { signal: expect.any(Object) });
  });
});

describe("useHomeScreen", () => {
  it("shows no status when nothing needs attention or is building", async () => {
    fake.inbox.mockResolvedValue({ ...sampleInbox, attentionCount: 0 });
    const { result } = await renderHome();
    await waitFor(() => expect(fake.listBuilds).toHaveBeenCalled());
    expect(result.current.status).toBeNull();
  });

  it("puts a request that needs you ahead of a running build", async () => {
    fake.listBuilds.mockResolvedValue([runningBuild]);
    const { result } = await renderHome();
    await waitFor(() => expect(result.current.status?.id).toBe("inbox"));
    expect(result.current.status).toMatchObject({ title: "Claude is waiting for your answer", actionLabel: "Open inbox" });
    result.current.status!.onAction();
    expect(mockRouter.push).toHaveBeenCalledWith("/inbox");
  });

  it("surfaces a running build with its progress and a view action", async () => {
    fake.inbox.mockResolvedValue({ ...sampleInbox, attentionCount: 0 });
    fake.listBuilds.mockResolvedValue([runningBuild]);
    const { result } = await renderHome();
    await waitFor(() => expect(result.current.status?.id).toBe("build"));
    expect(result.current.status).toMatchObject({ title: "Building Windows installer", progress: 0.42, actionLabel: "View" });
    result.current.status!.onAction();
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/sandbox/builds/[id]", params: { id: runningBuild.id } });
  });

  it("greets the tailnet user and toggles the drawer", async () => {
    const { result } = await renderHome();
    await waitFor(() => expect(result.current.name).toBe("You"));
    expect(result.current.drawer.visible).toBe(false);
    await act(async () => result.current.drawer.open());
    expect(result.current.drawer.visible).toBe(true);
    await act(async () => result.current.drawer.close());
    expect(result.current.drawer.visible).toBe(false);
  });

  it("starts a run from the composer and opens it", async () => {
    const { result } = await renderHome();
    await waitFor(() => expect(result.current.composer.project?.options).toHaveLength(1));
    await act(async () => result.current.composer.project!.select(sampleProject.id));
    await act(async () => result.current.composer.setText("Fix the build"));
    await act(async () => result.current.composer.send());
    await waitFor(() => expect(fake.startAgentRun).toHaveBeenCalled());
    expect(fake.startAgentRun).toHaveBeenCalledWith({ prompt: "Fix the build", mode: "bypassPermissions", projectId: sampleProject.id });
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/sandbox/agent/[id]", params: { id: "run_resumed" } }));
  });

  it("opens the inbox", async () => {
    const { result } = await renderHome();
    result.current.inbox.open();
    expect(mockRouter.push).toHaveBeenCalledWith("/inbox");
  });

  it("reports an unpaired device", async () => {
    resetSandboxState();
    const { result } = await renderHook(() => useHomeScreen(), wrapper());
    expect(result.current.paired).toBe(false);
    expect(fake.inbox).not.toHaveBeenCalled();
  });
});

describe("chat screens", () => {
  it("lists up to fifty sessions", async () => {
    const { result } = await renderHook(() => useChatsScreen(), wrapper());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await waitFor(() => expect(result.current.projectName(sampleProject.id)).toBe(sampleProject.name));
    expect(fake.sessions).toHaveBeenCalledWith({ limit: 50 }, expect.anything());
  });

  it("resumes a session with a new agent run and replaces the screen with it", async () => {
    const id = sampleClaudeSession.sessionId;
    const { result } = await renderHook(() => useResumeChat(id), wrapper());
    await waitFor(() => expect(result.current.session).not.toBeNull());
    await waitFor(() => expect(result.current.project).toBe(sampleProject.name));
    expect(result.current.title).toBe(sampleClaudeSession.title);
    expect(result.current.project).toBe(sampleProject.name);

    await act(async () => result.current.composer.setText("Keep going"));
    await act(async () => result.current.composer.send());
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
    expect(fake.startAgentRun).toHaveBeenCalledWith({
      prompt: "Keep going",
      mode: "bypassPermissions",
      projectId: sampleProject.id,
      resumeSessionId: id,
    });
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: "/sandbox/agent/[id]", params: { id: "run_resumed" } });
  });
});
