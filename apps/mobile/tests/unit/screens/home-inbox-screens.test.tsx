import { fireEvent, render, screen } from "@testing-library/react-native";
import { ChecksIcon } from "phosphor-react-native";
import { sampleClaudeSession, sampleInbox } from "@theone/protocol/fixtures";

import ResumeChatScreen from "@/app/chats/[id]";
import ChatsScreen from "@/app/chats/index";
import HomeScreen from "@/app/(tabs)/index";
import InboxScreen from "@/app/inbox";
import { groupInbox } from "@/features/inbox/utils/group";
import { chatComposerState } from "../chat/fixtures";

const mockHome = jest.fn();
const mockInbox = jest.fn();
const mockChats = jest.fn();
const mockResume = jest.fn();

jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ id: "ba4ddfd2" }), useIsFocused: () => true }));
jest.mock("@/features/home/hooks/use-home-screen", () => ({ useHomeScreen: () => mockHome() }));
jest.mock("@/features/home/components/home-drawer", () => {
  const { Text } = jest.requireActual("react-native");
  return { __esModule: true, default: ({ visible }: { visible: boolean }) => (visible ? <Text>Drawer open</Text> : null) };
});
jest.mock("@/features/inbox/hooks/use-inbox-screen", () => ({ useInboxScreen: () => mockInbox() }));
jest.mock("@/features/chats/hooks/use-chats-screen", () => ({ useChatsScreen: () => mockChats() }));
jest.mock("@/features/chats/hooks/use-resume-chat", () => ({ useResumeChat: () => mockResume() }));

const inboxOpen = jest.fn();
const drawerOpen = jest.fn();

function home(overrides: object = {}) {
  return {
    hydrated: true,
    paired: true,
    pair: jest.fn(),
    name: "Ada Lovelace",
    drawer: { visible: false, open: drawerOpen, close: jest.fn() },
    inbox: { unreadCount: 2, attention: "1 request needs you", open: inboxOpen },
    status: null,
    composer: chatComposerState(),
    ...overrides,
  };
}

function inbox(overrides: object = {}) {
  return {
    hydrated: true,
    paired: true,
    back: jest.fn(),
    pair: jest.fn(),
    sections: groupInbox(sampleInbox.items),
    projectName: () => "Electron hello",
    unreadCount: 1,
    attentionCount: 1,
    loading: false,
    error: null,
    retry: jest.fn(),
    markError: null,
    open: jest.fn(),
    markOne: jest.fn(),
    headerActions: [{ id: "mark-all-read", icon: ChecksIcon, label: "Mark all read", onPress: jest.fn() }],
    refreshing: false,
    refresh: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("HomeScreen", () => {
  afterEach(() => jest.useRealTimers());

  it("shows the headline and opens the drawer and inbox", async () => {
    mockHome.mockReturnValue(home());
    await render(<HomeScreen />);

    expect(screen.getByRole("header", { name: "Get things done." })).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Open menu"));
    expect(drawerOpen).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Open inbox, 2 unread"));
    expect(inboxOpen).toHaveBeenCalled();
  });

  it("renders the drawer when it is open", async () => {
    mockHome.mockReturnValue(home({ drawer: { visible: true, open: drawerOpen, close: jest.fn() } }));
    await render(<HomeScreen />);
    expect(screen.getByText("Drawer open")).toBeOnTheScreen();
  });

  it("docks the composer with the mode pill and opens the mode sheet", async () => {
    const composer = chatComposerState();
    mockHome.mockReturnValue(home({ composer }));
    await render(<HomeScreen />);

    expect(screen.getByLabelText("Chat with Claude")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Auto"));
    expect(composer.openSheet).toHaveBeenCalledWith("mode");
    await fireEvent.press(screen.getByLabelText("Record voice message"));
    expect(composer.startVoice).toHaveBeenCalled();
  });

  it("shows the live status inside the composer", async () => {
    const onAction = jest.fn();
    mockHome.mockReturnValue(
      home({
        status: { id: "build", title: "Building Android APK", message: "Compile", progress: 0.42, actionLabel: "View", onAction },
      }),
    );
    await render(<HomeScreen />);
    expect(screen.getByText("Building Android APK")).toBeOnTheScreen();
    expect(screen.getByLabelText("Building Android APK").props.accessibilityValue).toMatchObject({ now: 42 });
    await fireEvent.press(screen.getByText("View"));
    expect(onAction).toHaveBeenCalled();
  });

  it("asks to pair when no sandbox is paired", async () => {
    const pair = jest.fn();
    mockHome.mockReturnValue(home({ paired: false, pair }));
    await render(<HomeScreen />);
    await fireEvent.press(screen.getAllByText("Pair a sandbox")[1]);
    expect(pair).toHaveBeenCalled();
  });
});

describe("InboxScreen", () => {
  it("groups items and opens them on press", async () => {
    const state = inbox();
    mockInbox.mockReturnValue(state);
    await render(<InboxScreen />);

    expect(screen.getByText("Needs you")).toBeOnTheScreen();
    expect(screen.getByText("Earlier")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText(sampleInbox.items[0].title));
    expect(state.open).toHaveBeenCalledWith(sampleInbox.items[0]);
    await fireEvent(screen.getByText(sampleInbox.items[0].title), "longPress");
    expect(state.markOne).toHaveBeenCalledWith(sampleInbox.items[0]);
    await fireEvent.press(screen.getByLabelText("Mark all read"));
    expect(state.headerActions[0].onPress).toHaveBeenCalled();
  });

  it("shows the empty and error states", async () => {
    mockInbox.mockReturnValue(inbox({ sections: [], headerActions: [] }));
    await render(<InboxScreen />);
    expect(screen.getByText("Nothing needs you")).toBeOnTheScreen();

    const retry = jest.fn();
    mockInbox.mockReturnValue(inbox({ error: "Offline", retry }));
    await render(<InboxScreen />);
    await fireEvent.press(screen.getByText("Retry"));
    expect(retry).toHaveBeenCalled();
  });
});

describe("chat screens", () => {
  it("lists every chat and opens one", async () => {
    const open = jest.fn();
    mockChats.mockReturnValue({
      hydrated: true,
      paired: true,
      back: jest.fn(),
      items: [sampleClaudeSession],
      loading: false,
      error: null,
      retry: jest.fn(),
      open,
      newChat: jest.fn(),
      projectName: () => null,
      refreshing: false,
      refresh: jest.fn(),
    });
    await render(<ChatsScreen />);
    await fireEvent.press(screen.getByText(sampleClaudeSession.title!));
    expect(open).toHaveBeenCalledWith(sampleClaudeSession);
  });

  it("resumes a chat with a prompt", async () => {
    const send = jest.fn();
    mockResume.mockReturnValue({
      back: jest.fn(),
      session: sampleClaudeSession,
      title: sampleClaudeSession.title,
      project: "Electron hello",
      loading: false,
      error: null,
      composer: chatComposerState({ text: "Keep going", primary: "send", canSend: true, send }),
    });
    await render(<ResumeChatScreen />);
    expect(screen.getByText(sampleClaudeSession.preview!)).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Send"));
    expect(send).toHaveBeenCalled();
  });
});
