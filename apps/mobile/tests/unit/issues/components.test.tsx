import { fireEvent, render, screen } from "@testing-library/react-native";

import CreateIssueSheet from "@/features/issues/components/create-issue-sheet";
import IssueComment from "@/features/issues/components/issue-comment";
import IssueGroup from "@/features/issues/components/issue-group";
import IssueRow from "@/features/issues/components/issue-row";
import type { IssueFormState } from "@/features/issues/hooks/use-issue-form";
import { ISSUE_FORM_COPY } from "@/features/issues/utils/content";

import { makeIssue, sampleComment, sampleIssue } from "./fixtures";

jest.mock("expo-router", () => ({ useIsFocused: () => true }));

const formState = (overrides: Partial<IssueFormState> = {}): IssueFormState => ({
  visible: true,
  close: jest.fn(),
  projects: [],
  project: "tesseract",
  setProject: jest.fn(),
  title: "",
  setTitle: jest.fn(),
  description: "",
  setDescription: jest.fn(),
  status: "backlog",
  setStatus: jest.fn(),
  priority: "none",
  setPriority: jest.fn(),
  claude: false,
  setClaude: jest.fn(),
  human: "me",
  setHuman: jest.fn(),
  claudeHint: ISSUE_FORM_COPY.claudeOff,
  error: null,
  saving: false,
  submit: jest.fn(),
  ...overrides,
});

describe("IssueRow", () => {
  it("shows the identifier, title, Claude and a running indicator", async () => {
    const onPress = jest.fn();
    const onLongPress = jest.fn();
    const issue = makeIssue({ agentState: "running", status: "in_progress" });
    await render(<IssueRow issue={issue} onPress={onPress} onLongPress={onLongPress} />);

    expect(screen.getByTestId(`issue-row-${issue.id}-identifier`)).toHaveTextContent("MOBILE-12");
    expect(screen.getByText(issue.title)).toBeOnTheScreen();
    expect(screen.getByText("bug")).toBeOnTheScreen();
    expect(screen.getByTestId(`issue-row-${issue.id}-running`)).toBeOnTheScreen();
    expect(screen.getByTestId(`issue-row-${issue.id}-assignee`, { includeHiddenElements: true })).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(`issue-row-${issue.id}`));
    expect(onPress).toHaveBeenCalled();
    await fireEvent(screen.getByTestId(`issue-row-${issue.id}`), "longPress");
    expect(onLongPress).toHaveBeenCalled();
  });

  it("has no running indicator when idle", async () => {
    await render(<IssueRow issue={sampleIssue} onPress={jest.fn()} />);
    expect(screen.queryByTestId(`issue-row-${sampleIssue.id}-running`)).toBeNull();
  });
});

describe("IssueGroup", () => {
  it("hides its rows while collapsed and toggles from the header", async () => {
    const onToggle = jest.fn();
    const group = { status: "done" as const, issues: [makeIssue({ status: "done" })] };
    const { rerender } = await render(<IssueGroup group={group} collapsed onToggle={onToggle} onOpen={jest.fn()} />);
    expect(screen.getByText("Done")).toBeOnTheScreen();
    expect(screen.queryByTestId(`issue-row-${sampleIssue.id}`)).toBeNull();

    await fireEvent.press(screen.getByTestId("issue-group-done-toggle"));
    expect(onToggle).toHaveBeenCalled();

    await rerender(<IssueGroup group={group} collapsed={false} onToggle={onToggle} onOpen={jest.fn()} />);
    expect(screen.getByTestId(`issue-row-${sampleIssue.id}`)).toBeOnTheScreen();
  });
});

describe("CreateIssueSheet", () => {
  it("offers Me/Unassigned until Claude is assigned and shows the Claude hint", async () => {
    const state = formState();
    const { rerender } = await render(<CreateIssueSheet state={state} />);
    expect(screen.getByTestId("create-issue-assignee")).toBeOnTheScreen();
    expect(screen.getByText(ISSUE_FORM_COPY.claudeOff)).toBeOnTheScreen();

    await fireEvent(screen.getByTestId("create-issue-claude"), "valueChange", true);
    expect(state.setClaude).toHaveBeenCalledWith(true);
    await fireEvent.changeText(screen.getByTestId("create-issue-title"), "Ship it");
    expect(state.setTitle).toHaveBeenCalledWith("Ship it");
    await fireEvent.press(screen.getByTestId("create-issue-submit"));
    expect(state.submit).toHaveBeenCalled();

    await rerender(<CreateIssueSheet state={formState({ claude: true, status: "todo", claudeHint: ISSUE_FORM_COPY.claudeStarts })} />);
    expect(screen.queryByTestId("create-issue-assignee")).toBeNull();
    expect(screen.getByText(ISSUE_FORM_COPY.claudeStarts)).toBeOnTheScreen();
  });
});

describe("IssueComment", () => {
  it("renders Claude's markdown and links to its run", async () => {
    const onOpenRun = jest.fn();
    await render(<IssueComment comment={sampleComment} onOpenRun={onOpenRun} />);
    expect(screen.getByText("Claude")).toBeOnTheScreen();
    expect(screen.getByText("Finished.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(`issue-comment-${sampleComment.id}-run`));
    expect(onOpenRun).toHaveBeenCalledWith(sampleComment.agentRunId);
  });
});
