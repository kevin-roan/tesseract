import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { Issue, Project } from "@tesseract/protocol";
import { sampleProject } from "@tesseract/protocol/fixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findIssue, resetIssuesWorld } from "../../../../fixtures/projects-issues/data";
import { httpFixtures } from "../../../../fixtures/registry";
import { reply, type HttpFixtureRoute } from "../../../../fixtures/types";
import { fakeHost, renderTab } from "../kit/testing";

const listeners = new Map<string, (event: unknown) => void>();
const navigate = vi.fn();

vi.mock("../../../../app/connection", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useServerEvent: (type: string, listener: (event: unknown) => void) => {
    listeners.set(type, listener);
  },
}));

vi.mock("../../../../app/navigation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useNavigateTo: () => navigate,
}));

const { IssuesTab } = await import("./IssuesTab");

const project: Project = { ...sampleProject, id: "tesseract", name: "tesseract" };
const issueId = (number: number) => `iss_tesseract${number}`;
const current = (number: number) => findIssue(issueId(number)) as Issue;
const failing: HttpFixtureRoute[] = [];

function failRoute(method: string, path: string) {
  const route: HttpFixtureRoute = { method, path, respond: () => reply(500, { error: { code: "internal", message: "boom" } }) };
  failing.push(route);
  httpFixtures.unshift(route);
}

async function emit(type: string, event: object) {
  await act(async () => {
    listeners.get(type)?.({ type, ...event });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function column(name: string) {
  return within(screen.getByRole("group", { name: "Issue board" })).getByRole("region", { name });
}

function card(name: string, number: number) {
  return within(column(name)).getByRole("button", { name: new RegExp(`^TESSERACT-${number} `) });
}

async function renderIssues(host = fakeHost(), target = project) {
  renderTab(<IssuesTab project={target} host={host} />);
  await screen.findByRole("group", { name: "Issue board" });
  return host;
}

describe("IssuesTab", () => {
  beforeEach(() => {
    resetIssuesWorld();
    listeners.clear();
    navigate.mockReset();
  });

  afterEach(() => {
    for (const route of failing.splice(0)) httpFixtures.splice(httpFixtures.indexOf(route), 1);
  });

  it("renders a column per status with counts and issue cards", async () => {
    await renderIssues();
    const board = screen.getByRole("group", { name: "Issue board" });
    expect(within(board).getAllByRole("region").map((region) => region.getAttribute("aria-label"))).toEqual([
      "Backlog",
      "Todo",
      "In Progress",
      "In Review",
      "Done",
      "Canceled",
    ]);
    expect(within(column("Todo")).getByText("2")).toBeTruthy();
    const running = card("In Progress", 3);
    expect(within(running).getByRole("status", { name: "Claude is working" })).toBeTruthy();
    expect(within(running).getByRole("img", { name: "Claude" })).toBeTruthy();
    expect(within(running).getByRole("img", { name: "High" })).toBeTruthy();
    expect(within(running).getByText("onboarding")).toBeTruthy();
    expect(within(card("Todo", 5)).getByLabelText("Claude's last run failed")).toBeTruthy();
    expect(within(card("Todo", 4)).getByRole("img", { name: "Me" })).toBeTruthy();
    expect(within(card("Backlog", 6)).getByLabelText("Unassigned")).toBeTruthy();
  });

  it("filters by assignee and switches to the grouped list", async () => {
    await renderIssues();
    fireEvent.click(screen.getByRole("radio", { name: "Claude" }));
    expect(within(column("Todo")).queryByRole("button", { name: /^TESSERACT-4 / })).toBeNull();
    expect(card("Todo", 5)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Mine" }));
    expect(within(column("Todo")).queryByRole("button", { name: /^TESSERACT-5 / })).toBeNull();
    expect(card("Todo", 4)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "All" }));
    fireEvent.click(screen.getByRole("radio", { name: "List" }));
    const list = await screen.findByRole("group", { name: "Issues by status" });
    expect(within(list).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Backlog",
      "Todo",
      "In Progress",
      "In Review",
      "Done",
      "Canceled",
    ]);
    expect(within(within(list).getByRole("list", { name: "Todo" })).getAllByRole("listitem")).toHaveLength(2);
  });

  it("opens quick create with c and creates an issue assigned to Claude", async () => {
    await renderIssues();
    fireEvent.keyDown(document.body, { key: "c" });
    const dialog = await screen.findByRole("dialog", { name: /New issue/ });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Title" }), { target: { value: "Ship the issues tab" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Description" }), { target: { value: "With **markdown**" } });
    expect(within(dialog).getByText("Claude starts on its own once an issue is assigned to it and is not in Backlog.")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("switch", { name: "Assign to Claude" }));
    expect(within(dialog).getByText("Claude starts working as soon as the issue is created.")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Status" }).textContent).toContain("Todo");
    expect(within(dialog).getByRole("button", { name: "Assignee" }).textContent).toContain("Claude");
    const labels = within(dialog).getByLabelText("Add label");
    fireEvent.change(labels, { target: { value: "ui" } });
    fireEvent.keyDown(labels, { key: "Enter" });
    expect(within(dialog).getByRole("button", { name: "Remove ui" })).toBeTruthy();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Create issue" }));
    });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /New issue/ })).toBeNull());
    expect(current(9)).toMatchObject({ title: "Ship the issues tab", description: "With **markdown**", assignee: "claude", status: "todo", labels: ["ui"] });
    expect(card("Todo", 9).textContent).toContain("Ship the issues tab");
  });

  it("warns that Claude waits while the issue is in Backlog", async () => {
    await renderIssues();
    fireEvent.click(within(column("Backlog")).getByRole("button", { name: "New issue in Backlog" }));
    const dialog = await screen.findByRole("dialog", { name: /New issue/ });
    fireEvent.click(within(dialog).getByRole("switch", { name: "Assign to Claude" }));
    expect(within(dialog).getByRole("button", { name: "Status" }).textContent).toContain("Backlog");
    expect(within(dialog).getByText("Claude starts when the issue leaves Backlog.")).toBeTruthy();
  });

  it("ignores c while typing", async () => {
    await renderIssues();
    const input = document.createElement("input");
    document.body.append(input);
    fireEvent.keyDown(input, { key: "c" });
    expect(screen.queryByRole("dialog")).toBeNull();
    input.remove();
  });

  it("moves a card between columns optimistically when dropped", async () => {
    await renderIssues();
    fireEvent.dragStart(card("Backlog", 6));
    fireEvent.dragOver(column("Todo"));
    fireEvent.drop(column("Todo"));
    expect(card("Todo", 6)).toBeTruthy();
    expect(within(column("Backlog")).queryByRole("button", { name: /^TESSERACT-6 / })).toBeNull();
    await waitFor(() => expect(current(6)).toMatchObject({ status: "todo", sortOrder: 5 * 1024 + 1024 }));
  });

  it("rolls back a failed move and reports it", async () => {
    failRoute("PATCH", "/v1/issues/:id");
    const host = await renderIssues();
    fireEvent.dragStart(card("Backlog", 6));
    fireEvent.dragOver(column("Done"));
    fireEvent.drop(column("Done"));
    await waitFor(() => expect(host.report).toHaveBeenCalled());
    expect(card("Backlog", 6)).toBeTruthy();
    expect(current(6).status).toBe("backlog");
  });

  it("applies live issue events", async () => {
    await renderIssues();
    await emit("issue.updated", { issue: { ...current(4), status: "in_progress", agentState: "running", assignee: "claude" } });
    expect(within(card("In Progress", 4)).getByRole("status", { name: "Claude is working" })).toBeTruthy();
    await emit("issue.updated", { issue: { ...current(1), projectId: "other", status: "todo" } });
    expect(card("Done", 1)).toBeTruthy();
    await emit("issue.deleted", { id: issueId(7), projectId: "tesseract" });
    expect(within(column("Backlog")).queryByRole("button", { name: /^TESSERACT-7 / })).toBeNull();
  });

  it("shows a load error with retry", async () => {
    failRoute("GET", "/v1/issues");
    renderTab(<IssuesTab project={project} host={fakeHost()} />);
    expect(await screen.findByText("Couldn't load issues")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("shows the empty state with a create action", async () => {
    renderTab(<IssuesTab project={{ ...project, id: "streaxfit", name: "streaxfit" }} host={fakeHost()} />);
    expect(await screen.findByText("No issues yet")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "New issue" }).at(-1)!);
    expect(await screen.findByRole("dialog", { name: /New issue/ })).toBeTruthy();
  });
});
