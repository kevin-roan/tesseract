import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AppState, Linking } from "react-native";
import { TheOneClient } from "@theone/client";
import type { Inbox } from "@theone/protocol";
import { sampleArtifact, sampleInbox, sampleInboxItem, sampleProject } from "@theone/protocol/fixtures";

import { emitInboxEvent } from "@/features/inbox/api/events";
import { inboxKeys } from "@/features/inbox/api/query-keys";
import { useInboxNotifications } from "@/features/inbox/hooks/use-inbox-notifications";
import { useInboxScreen } from "@/features/inbox/hooks/use-inbox-screen";
import { usePushRegistration } from "@/features/inbox/hooks/use-push-registration";
import { getExpoPushToken, presentInboxNotification, subscribeNotificationTaps, subscribePushTokenChanges } from "@/features/inbox/notifications";
import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";

import { TEST_SANDBOX, TEST_TOKEN, createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../sandbox/helpers";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => true) };
let mockPathname = "/";

jest.mock("@theone/client", () => ({ ...jest.requireActual("@theone/client"), TheOneClient: jest.fn() }));
jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  usePathname: () => mockPathname,
  get router() {
    return mockRouter;
  },
}));
jest.mock("@/features/inbox/notifications", () => ({
  prepareNotifications: jest.fn(),
  presentInboxNotification: jest.fn(async () => undefined),
  subscribeNotificationTaps: jest.fn(() => () => undefined),
  getExpoPushToken: jest.fn(async () => null),
  subscribePushTokenChanges: jest.fn(() => () => undefined),
}));

const MockClient = TheOneClient as unknown as jest.Mock;
const mockPresent = presentInboxNotification as jest.Mock;
const mockTaps = subscribeNotificationTaps as jest.Mock;
const mockPushToken = getExpoPushToken as jest.Mock;
const mockTokenChanges = subscribePushTokenChanges as jest.Mock;
const fake = {
  health: jest.fn(),
  registerPushDevice: jest.fn(),
  unregisterPushDevice: jest.fn(),
  inbox: jest.fn(),
  markInboxRead: jest.fn(),
  listProjects: jest.fn(),
  listArtifacts: jest.fn(),
  artifactDownloadUrl: jest.fn(),
};
const fileItem = { ...sampleInboxItem, id: "inb_file", kind: "file" as const, terminalId: null, artifactId: sampleArtifact.id };
let openURL: jest.SpyInstance;

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  mockPathname = "/";
  setAppState("active");
  Object.values(mockRouter).forEach((fn) => fn.mockClear());
  mockPresent.mockClear();
  mockTaps.mockClear();
  mockPushToken.mockReset().mockResolvedValue(null);
  mockTokenChanges.mockClear();
  fake.health.mockReset().mockResolvedValue({ ok: true, version: "1", protocolVersion: 1, sandboxId: "remote-main" });
  fake.registerPushDevice.mockReset().mockResolvedValue({});
  fake.unregisterPushDevice.mockReset().mockResolvedValue({});
  fake.inbox.mockReset().mockResolvedValue(sampleInbox);
  fake.markInboxRead.mockReset().mockResolvedValue({ unreadCount: 0, attentionCount: 0 });
  fake.listProjects.mockReset().mockResolvedValue([sampleProject]);
  fake.listArtifacts.mockReset().mockResolvedValue([sampleArtifact]);
  fake.artifactDownloadUrl.mockReset().mockImplementation(async (id: string) => `http://sandbox/v1/artifacts/${id}/download?ticket=t`);
  openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  MockClient.mockReset().mockImplementation(() => fake);
});

afterEach(() => openURL.mockRestore());

function setAppState(state: string) {
  Object.defineProperty(AppState, "currentState", { value: state, configurable: true, writable: true });
}

async function renderInbox() {
  const queryClient = createTestQueryClient();
  const rendered = await renderHook(() => useInboxScreen(), { wrapper: createWrapper(queryClient) });
  await waitFor(() => expect(rendered.result.current.sections.length).toBeGreaterThan(0));
  await waitFor(() => expect(rendered.result.current.projectName(sampleProject.id)).toBe(sampleProject.name));
  return { ...rendered, queryClient };
}

describe("useInboxScreen", () => {
  it("groups the inbox and offers mark all read while something is unread", async () => {
    const { result } = await renderInbox();
    expect(result.current.sections[0].title).toBe("Needs you");
    expect(result.current.headerActions.map((action) => action.label)).toEqual(["Mark all read"]);

    await act(async () => result.current.headerActions[0].onPress());
    await waitFor(() => expect(result.current.unreadCount).toBe(0));
    expect(fake.markInboxRead).toHaveBeenCalledWith({ all: true });
    expect(result.current.headerActions).toEqual([]);
  });

  it("marks an item read and opens what it links to", async () => {
    const { result, queryClient } = await renderInbox();
    await act(async () => result.current.open(sampleInboxItem));
    await waitFor(() => expect(fake.markInboxRead).toHaveBeenCalledWith({ ids: [sampleInboxItem.id] }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/sandbox/terminal/[id]", params: { id: sampleInboxItem.terminalId } });
    await waitFor(() => {
      const item = queryClient.getQueryData<Inbox>(inboxKeys.list(TEST_SANDBOX.id))?.items.find((entry) => entry.id === sampleInboxItem.id);
      expect(item?.readAt).not.toBeNull();
    });
  });

  it("does not mark items that are already read", async () => {
    const { result } = await renderInbox();
    await act(async () => result.current.open({ ...sampleInboxItem, readAt: sampleInboxItem.updatedAt, terminalId: null, agentRunId: "run_1" }));
    expect(fake.markInboxRead).not.toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/sandbox/agent/[id]", params: { id: "run_1" } });
  });
});

describe("useInboxScreen shared files", () => {
  it("marks a file item read and downloads the file", async () => {
    const { result } = await renderInbox();
    await act(async () => result.current.open(fileItem));
    await waitFor(() => expect(openURL).toHaveBeenCalledWith(`http://sandbox/v1/artifacts/${sampleArtifact.id}/download?ticket=t`));
    expect(fake.markInboxRead).toHaveBeenCalledWith({ ids: [fileItem.id] });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("explains when the shared file has since been deleted", async () => {
    fake.listArtifacts.mockResolvedValue([]);
    const { result } = await renderInbox();
    await act(async () => result.current.open(fileItem));
    await waitFor(() => expect(result.current.downloadError).toMatch(/no longer on the sandbox/));
    expect(openURL).not.toHaveBeenCalled();
  });
});

describe("useInboxNotifications", () => {
  const attention = { type: "inbox.updated" as const, item: sampleInboxItem, unreadCount: 1, attentionCount: 1 };
  const tapData = (overrides: Record<string, unknown> = {}) => ({
    url: "/inbox",
    sandboxId: TEST_SANDBOX.id,
    itemId: sampleInboxItem.id,
    kind: sampleInboxItem.kind,
    artifactId: null,
    ...overrides,
  });

  it("shows a local notification for a new attention item outside the inbox, once", async () => {
    await renderHook(() => useInboxNotifications());
    emitInboxEvent(TEST_SANDBOX.id, attention);
    emitInboxEvent(TEST_SANDBOX.id, attention);
    expect(mockPresent).toHaveBeenCalledTimes(1);
    expect(mockPresent).toHaveBeenCalledWith(sampleInboxItem, TEST_SANDBOX.id);
  });

  it("notifies when a run finishes or fails", async () => {
    await renderHook(() => useInboxNotifications());
    emitInboxEvent(TEST_SANDBOX.id, { ...attention, item: { ...sampleInboxItem, id: "inb_done", kind: "completed" } });
    emitInboxEvent(TEST_SANDBOX.id, { ...attention, item: { ...sampleInboxItem, id: "inb_fail", kind: "failed" } });
    expect(mockPresent).toHaveBeenCalledTimes(2);
  });

  it("stays quiet on the inbox screen while active and for other sandboxes", async () => {
    mockPathname = "/inbox";
    await renderHook(() => useInboxNotifications());
    emitInboxEvent(TEST_SANDBOX.id, attention);
    emitInboxEvent("sbx_other", { ...attention, item: { ...sampleInboxItem, id: "inb_other" } });
    emitInboxEvent(TEST_SANDBOX.id, { ...attention, item: { ...sampleInboxItem, id: "inb_done", kind: "completed" } });
    expect(mockPresent).not.toHaveBeenCalled();
  });

  it("leaves the background to remote pushes", async () => {
    setAppState("background");
    await renderHook(() => useInboxNotifications());
    emitInboxEvent(TEST_SANDBOX.id, attention);
    expect(mockPresent).not.toHaveBeenCalled();
  });

  it("opens the inbox when a notification is tapped and ignores unknown data", async () => {
    await renderHook(() => useInboxNotifications());
    const onTap = mockTaps.mock.calls[0][0] as (data: unknown) => void;
    onTap({ url: "/elsewhere" });
    onTap({ url: "/inbox" });
    onTap(tapData());
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith("/inbox"));
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
  });

  it("notifies about shared files and opens Files to download them when tapped", async () => {
    await renderHook(() => useInboxNotifications());
    emitInboxEvent(TEST_SANDBOX.id, { ...attention, item: fileItem, attentionCount: 0 });
    expect(mockPresent).toHaveBeenCalledWith(fileItem, TEST_SANDBOX.id);

    const onTap = mockTaps.mock.calls[0][0] as (data: unknown) => void;
    onTap(tapData({ itemId: fileItem.id, kind: "file", artifactId: sampleArtifact.id }));
    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/files", params: { download: sampleArtifact.id } }),
    );
  });

  it("switches to the sandbox a push came from", async () => {
    const other = { ...TEST_SANDBOX, id: "sbx_other", name: "Other", baseUrl: "http://other:4000" };
    useSandboxStore.setState((state) => ({ sandboxes: [...state.sandboxes, other], tokens: { ...state.tokens, [other.id]: TEST_TOKEN } }));
    MockClient.mockImplementation(({ baseUrl }: { baseUrl: string }) => ({
      ...fake,
      health: async () => ({ ok: true, version: "1", protocolVersion: 1, sandboxId: baseUrl === other.baseUrl ? "remote-other" : "remote-main" }),
    }));
    await renderHook(() => useInboxNotifications());
    const onTap = mockTaps.mock.calls[0][0] as (data: unknown) => void;
    onTap(tapData({ sandboxId: "remote-other" }));
    await waitFor(() => expect(useSandboxStore.getState().activeId).toBe(other.id));
    expect(mockRouter.push).toHaveBeenCalledWith("/inbox");
  });
});

describe("usePushRegistration", () => {
  const PUSH = "ExponentPushToken[abc]";

  it("registers the push token with every paired sandbox that has a token", async () => {
    const other = { ...TEST_SANDBOX, id: "sbx_other", baseUrl: "http://other:4000" };
    const orphan = { ...TEST_SANDBOX, id: "sbx_orphan", baseUrl: "http://orphan:4000" };
    useSandboxStore.setState((state) => ({
      sandboxes: [...state.sandboxes, other, orphan],
      tokens: { ...state.tokens, [other.id]: TEST_TOKEN },
    }));
    mockPushToken.mockResolvedValue(PUSH);
    await renderHook(() => usePushRegistration());
    await waitFor(() => expect(fake.registerPushDevice).toHaveBeenCalledTimes(2));
    expect(fake.registerPushDevice).toHaveBeenCalledWith(expect.objectContaining({ token: PUSH, platform: "ios" }));
    expect(MockClient.mock.calls.map(([options]) => options.baseUrl)).not.toContain(orphan.baseUrl);
  });

  it("registers again when a sandbox is paired or the token rotates, but not for unchanged ones", async () => {
    mockPushToken.mockResolvedValue("ExponentPushToken[first]");
    await renderHook(() => usePushRegistration());
    await waitFor(() => expect(fake.registerPushDevice).toHaveBeenCalledTimes(1));

    const other = { ...TEST_SANDBOX, id: "sbx_new", baseUrl: "http://new:4000" };
    await act(async () => {
      useSandboxStore.setState((state) => ({ sandboxes: [...state.sandboxes, other], tokens: { ...state.tokens, [other.id]: TEST_TOKEN } }));
    });
    await waitFor(() => expect(fake.registerPushDevice).toHaveBeenCalledTimes(2));

    mockPushToken.mockResolvedValue("ExponentPushToken[second]");
    await act(async () => (mockTokenChanges.mock.calls[0][0] as () => void)());
    await waitFor(() => expect(fake.registerPushDevice).toHaveBeenCalledTimes(4));
    expect(fake.registerPushDevice).toHaveBeenLastCalledWith(expect.objectContaining({ token: "ExponentPushToken[second]" }));
  });

  it("does nothing without a push token and never throws on failures", async () => {
    await renderHook(() => usePushRegistration());
    await act(async () => undefined);
    expect(fake.registerPushDevice).not.toHaveBeenCalled();

    mockPushToken.mockResolvedValue("ExponentPushToken[fails]");
    fake.registerPushDevice.mockRejectedValue(new Error("offline"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await renderHook(() => usePushRegistration());
    await waitFor(() => expect(fake.registerPushDevice).toHaveBeenCalled());
    warn.mockRestore();
  });
});
