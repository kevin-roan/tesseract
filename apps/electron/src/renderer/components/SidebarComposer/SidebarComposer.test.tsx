import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SIDEBAR_COMPOSER_LABELS } from "./labels";
import { SidebarComposer, type SidebarComposerSend } from "./SidebarComposer";
import { useProjectSelection } from "./use-project-selection";

MotionGlobalConfig.skipAnimations = true;

const PROJECTS = [{ id: "monolith", name: "monolith" }, { id: "alpha", name: "Alpha" }];

function Harness({ online = true, onSend }: { online?: boolean; onSend(request: SidebarComposerSend): void }) {
  const [text, setText] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  return (
    <SidebarComposer
      value={text}
      onChange={setText}
      onSend={onSend}
      online={online}
      projects={PROJECTS}
      projectId={projectId}
      onProjectChange={setProjectId}
    />
  );
}

const input = () => screen.getByRole("textbox", { name: SIDEBAR_COMPOSER_LABELS.placeholder });
const send = () => screen.getByRole("button", { name: SIDEBAR_COMPOSER_LABELS.send }) as HTMLButtonElement;
const sendTooltip = () => send().closest("[title]")?.getAttribute("title");

describe("SidebarComposer", () => {
  it("is disabled offline with the offline tooltip", () => {
    render(<Harness online={false} onSend={vi.fn()} />);
    fireEvent.change(input(), { target: { value: "hi" } });
    expect(send().disabled).toBe(true);
    expect(sendTooltip()).toBe(SIDEBAR_COMPOSER_LABELS.offline);
  });

  it("sends the trimmed prompt with the selected project on Enter", async () => {
    const onSend = vi.fn();
    render(<Harness onSend={onSend} />);
    fireEvent.click(screen.getByRole("button", { name: SIDEBAR_COMPOSER_LABELS.projectTooltip }));
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([SIDEBAR_COMPOSER_LABELS.noProject, "Alpha", "monolith"]);
    fireEvent.click(options[2] as HTMLElement);
    fireEvent.change(input(), { target: { value: "  build it " } });
    expect(sendTooltip()).toBe(SIDEBAR_COMPOSER_LABELS.send);
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith({ prompt: "build it", projectId: "monolith" });
  });

  it("inserts newlines on Shift+Enter", () => {
    const onSend = vi.fn();
    render(<Harness onSend={onSend} />);
    fireEvent.change(input(), { target: { value: "x" } });
    fireEvent.keyDown(input(), { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });
});

describe("useProjectSelection", () => {
  it("keeps the selection by id and falls back when the project disappears", () => {
    const { result, rerender } = renderHook(({ projects }) => useProjectSelection(projects), { initialProps: { projects: PROJECTS } });
    act(() => result.current[1]("alpha"));
    expect(result.current[0]).toBe("alpha");
    rerender({ projects: [...PROJECTS].reverse() });
    expect(result.current[0]).toBe("alpha");
    rerender({ projects: [{ id: "monolith", name: "monolith" }] });
    expect(result.current[0]).toBeNull();
  });
});
