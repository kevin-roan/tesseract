import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { Issue, Project } from "@tesseract/protocol";
import { sampleProject } from "@tesseract/protocol/fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findIssue, issueDetail, resetIssuesWorld, RUNNING_ISSUE_RUN } from "../../../../fixtures/projects-issues/data";
import { fakeHost, renderTab } from "../kit/testing";

const navigate = vi.fn();

vi.mock("../../../../app/connection", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useServerEvent: () => undefined,
}));

vi.mock("../../../../app/navigation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useNavigateTo: () => navigate,
}));

const { IssuesTab } = await import("./IssuesTab");

const project: Project = { ...sampleProject, id: "tesseract", name: "tesseract" };
const current = (number: number) => findIssue(`iss_tesseract${number}`) as Issue;

async function openIssue(number: number) {
  renderTab(<IssuesTab project={project} host={fakeHost()} />);
  fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^TESSERACT-${number} `) }));
  return screen.findByRole("dialog", { name: `TESSERACT-${number}` });
}

async function pick(sheet: HTMLElement, picker: string, option: string) {
  fireEvent.click(within(sheet).getByRole("button", { name: picker }));
  await act(async () => {
    fireEvent.click(await screen.findByRole("option", { name: option }));
  });
}

describe("IssueSheet", () => {
  beforeEach(() => {
    resetIssuesWorld();
    navigate.mockReset();
  });

  it("shows a running Claude issue with its run link and follow-up composer", async () => {
    const sheet = await openIssue(3);
    expect((within(sheet).getByRole("textbox", { name: "Issue title" }) as HTMLInputElement).value).toBe("Add dark mode to the onboarding screens");
    expect(within(sheet).getByRole("button", { name: "Status" }).textContent).toContain("In Progress");
    expect(within(sheet).getByRole("button", { name: "Assignee" }).textContent).toContain("Claude");
    expect((within(sheet).getByRole("button", { name: "Run Claude now" }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(sheet).getByText("Claude is working on this issue.")).toBeTruthy();
    expect(within(sheet).getByText("Follow the", { exact: false })).toBeTruthy();
    fireEvent.click(within(sheet).getByRole("button", { name: "View run" }));
    expect(navigate).toHaveBeenCalledWith("agents", { runId: RUNNING_ISSUE_RUN });
    expect(within(sheet).getByRole("textbox", { name: "Comment… Claude gets it as a follow-up and continues the work." })).toBeTruthy();
    const feed = await within(sheet).findByRole("list", { name: "Activity" });
    expect(within(feed).getByText(`Claude started working (${RUNNING_ISSUE_RUN})`)).toBeTruthy();
    expect(within(feed).getByText("You")).toBeTruthy();
  });

  it("renders Claude's comments as markdown", async () => {
    const sheet = await openIssue(2);
    const feed = await within(sheet).findByRole("list", { name: "Activity" });
    const claude = feed.querySelector("[data-author='claude']") as HTMLElement;
    expect(within(claude).getByText("Claude")).toBeTruthy();
    expect(within(claude).getByText("useConnection").tagName).toBe("CODE");
  });

  it("runs Claude on an issue assigned to me", async () => {
    const sheet = await openIssue(4);
    expect(within(sheet).getByRole("textbox", { name: "Leave a comment…" })).toBeTruthy();
    await act(async () => {
      fireEvent.click(within(sheet).getByRole("button", { name: "Run Claude now" }));
    });
    expect(current(4)).toMatchObject({ assignee: "claude", agentState: "running" });
    await waitFor(() => expect((within(sheet).getByRole("button", { name: "Run Claude now" }) as HTMLButtonElement).disabled).toBe(true));
  });

  it("edits properties, title, description and labels", async () => {
    const sheet = await openIssue(6);
    await pick(sheet, "Status", "In Review");
    await waitFor(() => expect(current(6).status).toBe("in_review"));
    await pick(sheet, "Priority", "Urgent");
    await waitFor(() => expect(current(6).priority).toBe("urgent"));
    await pick(sheet, "Assignee", "Me");
    await waitFor(() => expect(current(6).assignee).toBe("me"));

    const title = within(sheet).getByRole("textbox", { name: "Issue title" });
    fireEvent.focus(title);
    fireEvent.change(title, { target: { value: "Document the event stream" } });
    fireEvent.blur(title);
    await waitFor(() => expect(current(6).title).toBe("Document the event stream"));

    fireEvent.click(within(sheet).getByRole("button", { name: "Edit" }));
    fireEvent.change(within(sheet).getByRole("textbox", { name: "Issue description" }), { target: { value: "Covers **all** events" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(current(6).description).toBe("Covers **all** events"));
    expect(within(sheet).getByText("all").tagName).toBe("STRONG");

    const labels = within(sheet).getByLabelText("Add label");
    fireEvent.change(labels, { target: { value: "api" } });
    fireEvent.keyDown(labels, { key: "Enter" });
    await waitFor(() => expect(current(6).labels).toEqual(["docs", "api"]));
    fireEvent.click(within(sheet).getByRole("button", { name: "Remove docs" }));
    await waitFor(() => expect(current(6).labels).toEqual(["api"]));
  });

  it("posts a comment", async () => {
    const sheet = await openIssue(4);
    await within(sheet).findByRole("list", { name: "Activity" });
    fireEvent.change(within(sheet).getByRole("textbox", { name: "Leave a comment…" }), { target: { value: "On it **today**" } });
    await act(async () => {
      fireEvent.click(within(sheet).getByRole("button", { name: "Comment" }));
    });
    expect(issueDetail(current(4)).comments.at(-1)).toMatchObject({ author: "me", body: "On it **today**" });
    expect(await within(sheet).findByText("today")).toBeTruthy();
    expect((within(sheet).getByRole("textbox", { name: "Leave a comment…" }) as HTMLTextAreaElement).value).toBe("");
  });

  it("deletes after confirming and closes the sheet", async () => {
    const sheet = await openIssue(7);
    fireEvent.click(within(sheet).getByRole("button", { name: "Delete issue" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Delete TESSERACT-7?" });
    await act(async () => {
      fireEvent.click(within(confirm).getByRole("button", { name: "Delete" }));
    });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "TESSERACT-7" })).toBeNull());
    expect(findIssue("iss_tesseract7")).toBeNull();
    expect(screen.queryByRole("button", { name: /^TESSERACT-7 / })).toBeNull();
  });

  it("closes with the close button", async () => {
    const sheet = await openIssue(1);
    fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "TESSERACT-1" })).toBeNull());
  });
});
