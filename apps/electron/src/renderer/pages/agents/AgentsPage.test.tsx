import { MotionGlobalConfig } from "motion/react";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { routePatterns, type AgentRun, type DeleteAgentRuns, type StartAgentRun } from "@theone/protocol";
import { sampleAgentRun, sampleUpload } from "@theone/protocol/fixtures";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ROUTES } from "../../app/routes";
import { COMPOSER_LABELS } from "../../components/Composer/labels";
import { ATTACHMENT_LABELS, MANAGE_LABELS } from "../../features/agents/labels";
import { resetAgentsUi, useAgentsUi } from "../../features/agents/store";
import { resetAgentsFixtures, SCENARIOS } from "../../fixtures/agents/http";
import { httpFixtures, overrideIpcFixtures } from "../../fixtures/registry";
import type { HttpFixtureRoute } from "../../fixtures/types";
import { createMemoryRouter, RouterProvider } from "react-router";
import { renderRoutes, renderWithProviders } from "../../test/render";

MotionGlobalConfig.skipAnimations = true;

const SLOW = { timeout: 5000 };

function useScenario(name: string) {
  window.history.replaceState(null, "", `/?scenario=${name}`);
}

beforeEach(() => {
  resetAgentsUi();
  resetAgentsFixtures();
  useScenario(SCENARIOS.list);
});

const cleanups: (() => void)[] = [];

afterEach(() => {
  window.history.replaceState(null, "", "/");
  while (cleanups.length) cleanups.pop()!();
});

function withRoutes(...routes: HttpFixtureRoute[]) {
  httpFixtures.unshift(...routes);
  cleanups.push(() => httpFixtures.splice(0, routes.length));
}

function composerOf(input: HTMLElement): HTMLElement {
  let node: HTMLElement | null = input;
  while (node && !within(node).queryByRole("button", { name: COMPOSER_LABELS.attach })) node = node.parentElement;
  return node!;
}

function captureStarts(): StartAgentRun[] {
  const bodies: StartAgentRun[] = [];
  withRoutes({
    method: "POST",
    path: routePatterns.rest.agentRuns,
    respond: ({ body }) => {
      const request = body as StartAgentRun;
      bodies.push(request);
      return { ...sampleAgentRun, id: `run_test_${bodies.length}`, prompt: request.prompt, projectId: request.projectId ?? null, archivedAt: null } satisfies AgentRun;
    },
  });
  return bodies;
}

describe("AgentsPage", () => {
  it("lists conversations with meta and shows the empty detail", async () => {
    renderRoutes(ROUTES, "/agents");
    expect(await screen.findByText("yes write this down to artiftecutre", {}, SLOW)).toBeTruthy();
    expect(screen.getByText("monolith · 327k tokens · follow-up")).toBeTruthy();
    expect(screen.getByText("No conversation selected")).toBeTruthy();
  });

  it("opens the new conversation view and fills a suggestion without sending", async () => {
    renderRoutes(ROUTES, "/agents");
    fireEvent.click(await screen.findByRole("button", { name: "New conversation" }, SLOW));
    const input = await screen.findByRole("textbox", { name: "What should Claude do?" });
    fireEvent.click(screen.getByRole("button", { name: "Fix failing tests" }));
    expect((input as HTMLTextAreaElement).value).toBe("Run the test suite, find the failing tests and fix them.");
    expect(useAgentsUi.getState().view).toBe("new");
  });

  it("starts a conversation and selects the new run", async () => {
    renderRoutes(ROUTES, "/agents/new");
    const input = await screen.findByRole("textbox", { name: "What should Claude do?" }, SLOW);
    fireEvent.change(input, { target: { value: "Write the release notes" } });
    fireEvent.click(screen.getByRole("button", { name: "Start conversation" }));
    await waitFor(() => expect(useAgentsUi.getState().view).toBe("conversation"));
    expect(useAgentsUi.getState().selectedRunId).toMatch(/^run_/);
    expect(useAgentsUi.getState().draft.prompt).toBe("");
  });

  it("starts a conversation with only an image attachment", async () => {
    const starts = captureStarts();
    withRoutes({ method: "POST", path: routePatterns.rest.uploads, respond: () => sampleUpload });
    cleanups.push(
      overrideIpcFixtures({
        attachments: {
          clipboardHasImage: () => true,
          pasteImage: () => ({ name: "shot.png", mimeType: "image/png", size: 4, base64: "AAAA" }),
        },
      }),
    );
    renderRoutes(ROUTES, "/agents/new");
    const composer = composerOf(await screen.findByRole("textbox", { name: "What should Claude do?" }, SLOW));
    fireEvent.click(within(composer).getByRole("button", { name: COMPOSER_LABELS.attach }));
    fireEvent.click(await screen.findByRole("menuitem", { name: COMPOSER_LABELS.paste }));
    expect(await within(composer).findByLabelText("shot.png")).toBeTruthy();
    const send = within(composer).getByRole("button", { name: "Start conversation" });
    await waitFor(() => expect((send as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(send);
    await waitFor(() => expect(starts).toHaveLength(1));
    expect(starts[0]).toMatchObject({ prompt: ATTACHMENT_LABELS.promptImage, attachmentIds: [sampleUpload.id] });
    await waitFor(() => expect(useAgentsUi.getState().view).toBe("conversation"));
  });

  it("sends one-shot params once and clears the draft afterwards", async () => {
    const starts = captureStarts();
    const router = createMemoryRouter(ROUTES, {
      initialEntries: [{ pathname: "/agents", state: { params: { prompt: "Ship it", send: true, projectId: "monolith" }, at: 1 } }],
    });
    renderWithProviders(<RouterProvider router={router} />);
    await waitFor(() => expect(starts).toHaveLength(1), SLOW);
    expect(starts[0]).toMatchObject({ prompt: "Ship it", projectId: "monolith" });
    await waitFor(() => expect(useAgentsUi.getState().view).toBe("conversation"));
    expect(useAgentsUi.getState().draft).toEqual({ prompt: "", projectId: "" });
    await waitFor(() => expect(router.state.location.state).toBeNull());
    await router.navigate("/agents/new");
    await screen.findByRole("textbox", { name: "What should Claude do?" });
    expect(starts).toHaveLength(1);
  });

  it("deletes all finished conversations by explicit ids", async () => {
    const deletes: DeleteAgentRuns[] = [];
    withRoutes({
      method: "POST",
      path: routePatterns.rest.agentRunsDelete,
      respond: ({ body }) => {
        deletes.push(body as DeleteAgentRuns);
        return { count: "ids" in (body as object) ? (body as { ids: string[] }).ids.length : 0 };
      },
    });
    renderRoutes(ROUTES, "/agents");
    await screen.findByText("yes write this down to artiftecutre", {}, SLOW);
    fireEvent.click(screen.getByRole("button", { name: MANAGE_LABELS.more }));
    fireEvent.click(await screen.findByRole("menuitem", { name: MANAGE_LABELS.deleteAll }));
    const pending = useAgentsUi.getState().pendingDelete;
    expect(pending?.body).toEqual({ ids: pending?.ids });
    expect(pending?.ids.length).toBeGreaterThan(0);
  });

  it("shows archived runs behind a clearable filter chip", async () => {
    renderRoutes(ROUTES, "/agents?filter=archived");
    expect(await screen.findByText("try this again", {}, SLOW)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
    await waitFor(() => expect(useAgentsUi.getState().filter).toBe("all"));
    expect(await screen.findByText("yes write this down to artiftecutre")).toBeTruthy();
  });

  it("filters by search query", async () => {
    renderRoutes(ROUTES, "/agents?search");
    await screen.findByText("yes write this down to artiftecutre", {}, SLOW);
    fireEvent.change(await screen.findByRole("searchbox"), { target: { value: "hybrid" } });
    await waitFor(() => expect(screen.queryByText("yes write this down to artiftecutre")).toBeNull());
    expect(screen.getByText("Tell me how the shift manager on the POS closes a till")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz-nothing" } });
    expect(await screen.findByText("Nothing matches")).toBeTruthy();
  });

  it("renders attention cards, terminal sessions and marks items read", async () => {
    useScenario(SCENARIOS.attention);
    renderRoutes(ROUTES, "/agents");
    const section = await screen.findByRole("region", { name: "Needs you" }, SLOW);
    expect(within(section).getByText("Claude needs your input")).toBeTruthy();
    expect(await screen.findByText("Refactor the receipt printer driver")).toBeTruthy();
    fireEvent.click(within(section).getAllByRole("button", { name: "Mark as read" })[0]!);
    await waitFor(() => expect(screen.queryByText("Claude needs your input")).toBeNull());
  });

  it("shows the empty list placeholder", async () => {
    useScenario(SCENARIOS.empty);
    renderRoutes(ROUTES, "/agents");
    expect(await screen.findByText("No conversations yet", {}, SLOW)).toBeTruthy();
  });
});
