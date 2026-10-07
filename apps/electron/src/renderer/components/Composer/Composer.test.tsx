import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Composer, type ComposerProps } from "./Composer";
import { COMPOSER_LABELS } from "./labels";

MotionGlobalConfig.skipAnimations = true;

type HarnessProps = Partial<ComposerProps> & { initial?: string };

function Harness({ initial = "", ...props }: HarnessProps) {
  const [value, setValue] = useState(initial);
  return <Composer value={value} onChange={setValue} onSubmit={vi.fn()} placeholder="Reply to Claude…" sendLabel="Reply" {...props} />;
}

const textbox = () => screen.getByRole("textbox", { name: "Reply to Claude…" });
const sendButton = () => screen.getByRole("button", { name: "Reply" });

describe("Composer", () => {
  it("shows the placeholder only while empty and disables send", () => {
    render(<Harness />);
    expect(screen.getByText("Reply to Claude…")).toBeTruthy();
    expect((sendButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(textbox(), { target: { value: "hi" } });
    expect(screen.queryByText("Reply to Claude…")).toBeNull();
    expect((sendButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it("submits trimmed text on Enter and keeps the text", () => {
    const onSubmit = vi.fn();
    render(<Harness initial="  fix it  " onSubmit={onSubmit} />);
    fireEvent.keyDown(textbox(), { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("fix it");
    expect((textbox() as HTMLTextAreaElement).value).toBe("  fix it  ");
  });

  it("does not submit on Shift+Enter and consumes Enter when submit is not allowed", () => {
    const onSubmit = vi.fn();
    render(<Harness initial="" onSubmit={onSubmit} />);
    const shift = fireEvent.keyDown(textbox(), { key: "Enter", shiftKey: true });
    expect(shift).toBe(true);
    const plain = fireEvent.keyDown(textbox(), { key: "Enter" });
    expect(plain).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits with Ctrl+Enter too", () => {
    const onSubmit = vi.fn();
    render(<Harness initial="go" onSubmit={onSubmit} />);
    fireEvent.keyDown(textbox(), { key: "Enter", ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledWith("go");
  });

  it("allows an empty prompt with attachments unless blocked", () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<Harness hasAttachments onSubmit={onSubmit} />);
    expect((sendButton() as HTMLButtonElement).disabled).toBe(false);
    rerender(<Harness hasAttachments attachmentsBlocked onSubmit={onSubmit} />);
    expect((sendButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the lock reason instead of the hint and makes the input read-only", () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<Harness initial="x" hint="Hint" onSubmit={onSubmit} />);
    expect(screen.getByText("Hint")).toBeTruthy();
    rerender(<Harness initial="x" hint="Hint" locked={COMPOSER_LABELS.lockedRunning} onSubmit={onSubmit} />);
    expect(screen.queryByText("Hint")).toBeNull();
    expect(screen.getByText(COMPOSER_LABELS.lockedRunning).className).toContain("hintLocked");
    expect((textbox() as HTMLTextAreaElement).readOnly).toBe(true);
    fireEvent.keyDown(textbox(), { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows a spinner while busy, or a stop button when stoppable", () => {
    const onStop = vi.fn();
    const { rerender } = render(<Harness initial="x" busy />);
    expect((sendButton() as HTMLButtonElement).disabled).toBe(true);
    expect(sendButton().getAttribute("data-state")).toBe("busy");
    rerender(<Harness initial="x" busy onStop={onStop} stopLabel="Stop" />);
    const stop = screen.getByRole("button", { name: "Stop" });
    expect((stop as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(stop);
    expect(onStop).toHaveBeenCalled();
  });

  it("renders the large variant with a pill send button", () => {
    render(<Harness large sendLabel="Start conversation" placeholder="What should Claude do?" />);
    const send = screen.getByRole("button", { name: "Start conversation" });
    expect(send.className).toContain("pill");
    expect(send.textContent).toBe("Start conversation");
  });

  it("completes slash commands from the hint list", async () => {
    render(<Harness slashCommands={[{ command: "review", description: "Review" }, { command: "run" }]} />);
    fireEvent.change(textbox(), { target: { value: "/r" } });
    expect(screen.getAllByRole("option")).toHaveLength(2);
    fireEvent.keyDown(textbox(), { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[1]?.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(textbox(), { key: "Tab" });
    expect((textbox() as HTMLTextAreaElement).value).toBe("/run ");
    await waitFor(() => expect(screen.queryByRole("option")).toBeNull());
  });

  it("dismisses slash hints with Escape and does not submit while open", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} slashCommands={[{ command: "review" }]} />);
    fireEvent.change(textbox(), { target: { value: "/" } });
    fireEvent.keyDown(textbox(), { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
    expect((textbox() as HTMLTextAreaElement).value).toBe("/review ");
    fireEvent.change(textbox(), { target: { value: "/" } });
    fireEvent.keyDown(textbox(), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });

  it("opens the attach menu and reports the kind", async () => {
    const onAttach = vi.fn();
    render(<Harness onAttach={onAttach} />);
    fireEvent.click(screen.getByRole("button", { name: COMPOSER_LABELS.attach }));
    const item = await screen.findByRole("menuitem", { name: COMPOSER_LABELS.images });
    fireEvent.click(item);
    expect(onAttach).toHaveBeenCalledWith("images");
  });

  it("marks itself as a drop target while files are dragged over", () => {
    const onDropFiles = vi.fn();
    const { container } = render(<Harness onDropFiles={onDropFiles} />);
    const root = container.firstElementChild as HTMLElement;
    const file = new File(["x"], "a.txt", { type: "text/plain" });
    const dataTransfer = { types: ["Files"], files: [file], dropEffect: "none" };
    act(() => {
      fireEvent.dragEnter(root, { dataTransfer });
    });
    expect(root.getAttribute("data-drop-target")).toBe("true");
    act(() => {
      fireEvent.drop(root, { dataTransfer });
    });
    expect(root.getAttribute("data-drop-target")).toBeNull();
    expect(onDropFiles).toHaveBeenCalledWith([file]);
  });

  it("forwards the textarea ref", () => {
    const ref = { current: null as HTMLTextAreaElement | null };
    render(<Harness inputRef={ref} />);
    expect(ref.current).toBe(textbox());
  });
});
