import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CONVERSATION_RUNS, conversationDoneRun, conversationRunningRun } from "../../../fixtures/agents-conversation/data";
import { renderRoutes } from "../../../test/render";
import { ConversationView } from "./ConversationView";
import type { ConversationViewProps } from "./types";

function renderView(props: Partial<ConversationViewProps> & { runId: string }) {
  const onSelectRun = vi.fn();
  const view = renderRoutes(
    [{ path: "/", element: <ConversationView runs={CONVERSATION_RUNS} names={{ tesseract: "tesseract" }} onSelectRun={onSelectRun} {...props} /> }],
    "/",
  );
  return { ...view, onSelectRun };
}

describe("ConversationView", () => {
  let skip: boolean | undefined;
  beforeAll(() => {
    skip = MotionGlobalConfig.skipAnimations;
    MotionGlobalConfig.skipAnimations = true;
  });
  afterAll(() => {
    MotionGlobalConfig.skipAnimations = skip;
  });

  it("loads a finished run and renders its timeline", async () => {
    const { onSelectRun } = renderView({ runId: conversationDoneRun.id });
    expect(await screen.findByText("Finished")).toBeTruthy();
    expect(screen.getAllByText("yes write this down to artiftecutre").length).toBeGreaterThan(0);
    expect(screen.getByText("Claude")).toBeTruthy();
    expect(screen.getByText("Run finished in 92.6 s, 6 turns, 327,230 tokens")).toBeTruthy();
    expect(screen.getByText("1m 36s · 327k tokens")).toBeTruthy();
    const previous = screen.getByRole("button", { name: /Continues “what if the host machine/ });
    fireEvent.click(previous);
    expect(onSelectRun).toHaveBeenCalledWith("run_conv_previous");
    expect(screen.getByRole("button", { name: "Archive" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
  });

  it("streams a running run and locks the composer", async () => {
    renderView({ runId: conversationRunningRun.id, run: conversationRunningRun });
    expect(await screen.findByText("Bash")).toBeTruthy();
    expect(screen.getByText("Claude is thinking…")).toBeTruthy();
    expect(screen.getByText("Claude is still working. You can reply when this run ends.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy();
    expect(screen.getByText("Running")).toBeTruthy();
  });

  it("starts a follow-up and selects the new run", async () => {
    const { onSelectRun } = renderView({ runId: conversationDoneRun.id });
    await screen.findByText("Finished");
    const input = screen.getByRole("textbox", { name: "Reply to Claude…" });
    fireEvent.change(input, { target: { value: "Now commit it" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(onSelectRun).toHaveBeenCalledWith(expect.stringMatching(/^run_/)));
  });

  it("stops a running run after confirmation", async () => {
    const onRunChanged = vi.fn();
    renderView({ runId: conversationRunningRun.id, run: conversationRunningRun, onRunChanged });
    fireEvent.click(await screen.findByRole("button", { name: "Stop" }));
    fireEvent.click(await screen.findByRole("button", { name: "Stop run" }));
    await waitFor(() => expect(onRunChanged).toHaveBeenCalledWith(expect.objectContaining({ state: "cancelled" })));
    expect(await screen.findByText("Run cancelled")).toBeTruthy();
  });

  it("shows the load error with a retry", async () => {
    renderView({ runId: "run_missing" });
    expect(await screen.findByText("Couldn't load this conversation")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("forwards manage actions and renders the sync slot", async () => {
    const onManage = vi.fn();
    const renderSync = vi.fn(() => <span>sync-slot</span>);
    renderView({ runId: conversationDoneRun.id, onManage, renderSync, compact: true });
    await screen.findByText("Finished");
    expect(screen.getByText("sync-slot")).toBeTruthy();
    expect(renderSync).toHaveBeenLastCalledWith(expect.objectContaining({ projectId: "tesseract", compact: true, running: false }));
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onManage).toHaveBeenCalledWith("archive", expect.objectContaining({ id: conversationDoneRun.id }));
  });
});
