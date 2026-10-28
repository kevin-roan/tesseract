import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ApiError, TesseractClient } from "@tesseract/client";
import type { Issue } from "@tesseract/protocol";
import { sampleProject } from "@tesseract/protocol/fixtures";

import { issueKeys } from "@/features/issues/api/query-keys";
import { useIssueDetailScreen } from "@/features/issues/hooks/use-issue-detail-screen";
import { useIssueForm } from "@/features/issues/hooks/use-issue-form";
import { useIssuesEntry } from "@/features/issues/hooks/use-issues-entry";
import { useProjectIssuesScreen } from "@/features/issues/hooks/use-project-issues-screen";
import { ISSUE_FORM_COPY } from "@/features/issues/utils/content";
import { confirm } from "@/lib/confirm";

import { TEST_SANDBOX, createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../sandbox/helpers";
import { PROJECT_ID, makeIssue, sampleIssue, sampleIssueDetail } from "./fixtures";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };

jest.mock("@tesseract/client", () => ({ ...jest.requireActual("@tesseract/client"), TesseractClient: jest.fn() }));
jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  get router() {
    return mockRouter;
  },
}));
jest.mock("@/lib/confirm", () => ({ confirm: jest.fn(async () => true) }));

const MockClient = TesseractClient as unknown as jest.Mock;
const mockConfirm = confirm as jest.Mock;
const fake = {
  getProject: jest.fn(),
  listIssues: jest.fn(),
  getIssue: jest.fn(),
  createIssue: jest.fn(),
  updateIssue: jest.fn(),
  deleteIssue: jest.fn(),
  commentOnIssue: jest.fn(),
  dispatchIssue: jest.fn(),
};

const issues: Issue[] = [
  sampleIssue,
  makeIssue({ id: "iss_mine", number: 3, assignee: "me", status: "backlog" }),
  makeIssue({ id: "iss_done", number: 1, assignee: null, status: "done" }),
];

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  Object.values(mockRouter).forEach((fn) => fn.mockClear());
  mockConfirm.mockReset().mockResolvedValue(true);
  Object.values(fake).forEach((fn) => fn.mockReset());
  fake.getProject.mockResolvedValue({ ...sampleProject, id: PROJECT_ID, name: "Mobile" });
  fake.listIssues.mockResolvedValue(issues);
  fake.getIssue.mockResolvedValue(sampleIssueDetail);
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useProjectIssuesScreen", () => {
  it("groups, filters and collapses closed groups", async () => {
    const { result } = await renderHook(() => useProjectIssuesScreen(PROJECT_ID), { wrapper: createWrapper(createTestQueryClient()) });
    await waitFor(() => expect(result.current.total).toBe(3));
    expect(fake.listIssues).toHaveBeenCalledWith({ projectId: PROJECT_ID }, expect.anything());
    expect(result.current.openCount).toBe(2);
    expect(result.current.groups.map((group) => group.status)).toEqual(["backlog", "todo", "done"]);
    expect(result.current.isCollapsed("done")).toBe(true);
    expect(result.current.isCollapsed("todo")).toBe(false);

    await act(async () => result.current.toggleGroup("done"));
    expect(result.current.isCollapsed("done")).toBe(false);

    await act(async () => result.current.setFilter("mine"));
    expect(result.current.groups.map((group) => group.issues.map((issue) => issue.id))).toEqual([["iss_mine"]]);

    await act(async () => result.current.open("iss_mine"));
    expect(mockRouter.push).toHaveBeenCalledWith("/sandbox/issues/iss_mine");
  });

  it("changes status optimistically from the long-press sheet and rolls back on failure", async () => {
    const queryClient = createTestQueryClient();
    let reject: (error: Error) => void = () => undefined;
    fake.updateIssue.mockImplementation(() => new Promise((_resolve, fail) => (reject = fail)));
    const { result } = await renderHook(() => useProjectIssuesScreen(PROJECT_ID), { wrapper: createWrapper(queryClient) });
    await waitFor(() => expect(result.current.total).toBe(3));

    await act(async () => result.current.changeStatus(sampleIssue));
    expect(result.current.statusSheet.visible).toBe(true);
    expect(result.current.statusSheet.selectedId).toBe("todo");
    await act(async () => result.current.statusSheet.onSelect("in_review"));

    const listKey = issueKeys.list(TEST_SANDBOX.id, { projectId: PROJECT_ID });
    await waitFor(() =>
      expect(queryClient.getQueryData<Issue[]>(listKey)?.find((issue) => issue.id === sampleIssue.id)?.status).toBe("in_review"),
    );
    expect(fake.updateIssue).toHaveBeenCalledWith(sampleIssue.id, { status: "in_review" });

    await act(async () => reject(new ApiError(409, "conflict", "Nope")));
    await waitFor(() => expect(result.current.actionError).toBe("Nope"));
    expect(queryClient.getQueryData<Issue[]>(listKey)?.find((issue) => issue.id === sampleIssue.id)?.status).toBe("todo");
  });
});

describe("useIssuesEntry", () => {
  it("counts open issues and opens the list", async () => {
    const { result } = await renderHook(() => useIssuesEntry(PROJECT_ID), { wrapper: createWrapper(createTestQueryClient()) });
    await waitFor(() => expect(result.current.openCount).toBe(2));
    await act(async () => result.current.open());
    expect(mockRouter.push).toHaveBeenCalledWith(`/sandbox/issues?projectId=${PROJECT_ID}`);
  });
});

describe("useIssueForm", () => {
  it("defaults the status from the assignee and creates the issue", async () => {
    const created = makeIssue({ id: "iss_new", number: 13 });
    fake.createIssue.mockResolvedValue(created);
    const onCreated = jest.fn();
    const { result } = await renderHook(() => useIssueForm(PROJECT_ID, onCreated), { wrapper: createWrapper(createTestQueryClient()) });

    await act(async () => result.current.open());
    expect(result.current.sheet.status).toBe("backlog");
    expect(result.current.sheet.claudeHint).toBe(ISSUE_FORM_COPY.claudeOff);

    await act(async () => result.current.sheet.submit());
    expect(result.current.sheet.error).toBe(ISSUE_FORM_COPY.titleRequired);
    expect(fake.createIssue).not.toHaveBeenCalled();

    await act(async () => result.current.sheet.setClaude(true));
    expect(result.current.sheet.status).toBe("todo");
    expect(result.current.sheet.claudeHint).toBe(ISSUE_FORM_COPY.claudeStarts);
    await act(async () => result.current.sheet.setStatus("backlog"));
    expect(result.current.sheet.claudeHint).toBe(ISSUE_FORM_COPY.claudeWaits);
    await act(async () => result.current.sheet.setStatus("todo"));

    await act(async () => result.current.sheet.setTitle("  Ship it  "));
    await act(async () => result.current.sheet.setPriority("urgent"));
    await act(async () => result.current.sheet.submit());

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
    expect(fake.createIssue).toHaveBeenCalledWith(PROJECT_ID, { title: "Ship it", status: "todo", priority: "urgent", assignee: "claude" });
    expect(result.current.sheet.visible).toBe(false);
  });

  it("assigns to nobody when unassigned is chosen", async () => {
    fake.createIssue.mockResolvedValue(sampleIssue);
    const { result } = await renderHook(() => useIssueForm(PROJECT_ID), { wrapper: createWrapper(createTestQueryClient()) });
    await act(async () => result.current.open());
    await act(async () => result.current.sheet.setHuman("unassigned"));
    await act(async () => result.current.sheet.setTitle("Later"));
    await act(async () => result.current.sheet.setDescription("Some *notes*"));
    await act(async () => result.current.sheet.submit());
    await waitFor(() =>
      expect(fake.createIssue).toHaveBeenCalledWith(PROJECT_ID, {
        title: "Later",
        description: "Some *notes*",
        status: "backlog",
        priority: "none",
        assignee: null,
      }),
    );
  });
});

describe("useIssueDetailScreen", () => {
  const renderDetail = (queryClient = createTestQueryClient()) =>
    renderHook(() => useIssueDetailScreen(sampleIssue.id), { wrapper: createWrapper(queryClient) });

  it("loads the issue with its activity and edits properties", async () => {
    fake.updateIssue.mockImplementation(async (_id: string, body: Partial<Issue>) => ({ ...sampleIssue, ...body }));
    const { result } = await renderDetail();
    await waitFor(() => expect(result.current.comments).toHaveLength(1));
    expect(result.current.identifier).toBe("MOBILE-12");
    expect(result.current.composer.placeholder).toMatch(/follow-up/);

    await act(async () => result.current.properties.selectPriority("low"));
    await waitFor(() => expect(fake.updateIssue).toHaveBeenCalledWith(sampleIssue.id, { priority: "low" }));
    await act(async () => result.current.properties.selectAssignee("unassigned"));
    await waitFor(() => expect(fake.updateIssue).toHaveBeenCalledWith(sampleIssue.id, { assignee: null }));

    await act(async () => result.current.title.begin());
    await act(async () => result.current.title.setValue("Fix the login screen"));
    await act(async () => result.current.title.commit());
    expect(fake.updateIssue).toHaveBeenCalledTimes(2);
    await act(async () => result.current.title.begin());
    await act(async () => result.current.title.setValue("  Fix login  "));
    await act(async () => result.current.title.commit());
    await waitFor(() => expect(fake.updateIssue).toHaveBeenCalledWith(sampleIssue.id, { title: "Fix login" }));

    await act(async () => result.current.properties.editLabels());
    await act(async () => result.current.labelsSheet.setText("bug, ui"));
    await act(async () => result.current.labelsSheet.submit());
    await waitFor(() => expect(fake.updateIssue).toHaveBeenCalledWith(sampleIssue.id, { labels: ["bug", "ui"] }));
  });

  it("disables Run Claude while a run is going and links to it", async () => {
    fake.getIssue.mockResolvedValue({ ...sampleIssueDetail, status: "in_progress", agentState: "running", agentRunId: "run_live" });
    const { result } = await renderDetail();
    await waitFor(() => expect(result.current.claude.running).toBe(true));
    expect(result.current.claude.canRun).toBe(false);
    await act(async () => result.current.claude.viewRun?.());
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/sandbox/agent/[id]", params: { id: "run_live" } });
  });

  it("dispatches Claude and posts comments", async () => {
    fake.dispatchIssue.mockResolvedValue({ ...sampleIssue, agentState: "running", agentRunId: "run_new" });
    fake.commentOnIssue.mockResolvedValue({ ...sampleIssueDetail.comments[0], id: "isc_new", author: "me", body: "More" });
    const { result } = await renderDetail();
    await waitFor(() => expect(result.current.claude.canRun).toBe(true));

    await act(async () => result.current.claude.runNow());
    await waitFor(() => expect(result.current.claude.running).toBe(true));
    expect(fake.dispatchIssue).toHaveBeenCalledWith(sampleIssue.id, {});

    await act(async () => result.current.composer.setText(" More "));
    await act(async () => result.current.composer.send());
    await waitFor(() => expect(result.current.comments).toHaveLength(2));
    expect(fake.commentOnIssue).toHaveBeenCalledWith(sampleIssue.id, { body: "More" });
    expect(result.current.composer.text).toBe("");
  });

  it("deletes only after confirming", async () => {
    fake.deleteIssue.mockResolvedValue(sampleIssue);
    const { result } = await renderDetail();
    await waitFor(() => expect(result.current.headerActions).toHaveLength(1));

    mockConfirm.mockResolvedValueOnce(false);
    await act(async () => result.current.headerActions[0].onPress());
    expect(fake.deleteIssue).not.toHaveBeenCalled();

    await act(async () => result.current.headerActions[0].onPress());
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(fake.deleteIssue).toHaveBeenCalledWith(sampleIssue.id);
  });

  it("reports a missing issue", async () => {
    fake.getIssue.mockRejectedValue(new ApiError(404, "not_found", "Issue not found"));
    const { result } = await renderDetail();
    await waitFor(() => expect(result.current.missing).toBe(true));
  });
});
