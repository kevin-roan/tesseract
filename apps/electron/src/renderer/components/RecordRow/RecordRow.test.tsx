import { MotionGlobalConfig } from "motion/react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TOOLTIP_OPEN_DELAY_MS, TOOLTIP_SKIP_DELAY_MS } from "../Tooltip/constants";
import { RecordRow } from "./RecordRow";

MotionGlobalConfig.skipAnimations = true;

const noop = () => undefined;

describe("RecordRow", () => {
  it("renders the title, subtitle, code, meta and status badge", () => {
    const { container } = render(
      <RecordRow icon="file" code="1" codeTone="info" title="dev server" subtitle="bun run dev" meta="pid 123" status={{ label: "Running", tone: "success" }} />,
    );
    expect(container.querySelector(".code")?.textContent).toBe("1");
    expect(container.querySelector(".title")?.textContent).toBe("dev server");
    expect(container.querySelector(".subtitle")?.textContent).toBe("bun run dev");
    expect(container.querySelector(".body")?.className).toContain("withSubtitle");
    expect(screen.getByText("Running")).toBeTruthy();
  });

  it("replaces the icon with a status glyph", () => {
    render(<RecordRow icon="file" title="build" status={{ label: "Failed", tone: "danger", glyph: true }} />);
    expect(screen.queryByText("Failed")).toBeNull();
    expect(screen.getByLabelText("Failed")).toBeTruthy();
  });

  it("hides the progress bar unless progress is set and supports indeterminate", () => {
    const { rerender, container } = render(<RecordRow title="build" />);
    expect(container.querySelector("[role=progressbar]")).toBeNull();
    rerender(<RecordRow title="build" progress={null} />);
    expect(container.querySelector("[role=progressbar]")?.hasAttribute("aria-valuenow")).toBe(false);
    rerender(<RecordRow title="build" progress={0.4} />);
    expect(container.querySelector("[role=progressbar]")?.getAttribute("aria-valuenow")).toBe("40");
  });

  it("puts icon-only actions in the hover overlay", () => {
    const onStop = vi.fn();
    const { container } = render(<RecordRow title="dev" actions={[{ id: "stop", icon: "stop", label: "Stop", onActivate: onStop }]} />);
    const overlay = container.querySelector(".hoverActions");
    expect(overlay?.querySelector("button[aria-label=Stop]")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it("renders every action inline when one is labeled", () => {
    const { container } = render(
      <RecordRow
        title="web"
        actions={[
          { id: "run", icon: "play", label: "Run", onActivate: noop, labeled: true },
          { id: "stop", icon: "stop", label: "Stop", onActivate: noop, sensitive: false },
        ]}
      />,
    );
    expect(container.querySelector(".hoverActions")).toBeNull();
    expect(screen.getByRole("button", { name: "Run" }).textContent).toBe("Run");
    expect((screen.getByRole("button", { name: "Stop" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("activates through the row", () => {
    const onActivate = vi.fn();
    const { container } = render(<RecordRow title="row" onActivate={onActivate} />);
    fireEvent.click(container.firstElementChild as HTMLElement);
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it("shows the themed tooltip only when the text is truncated", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    vi.advanceTimersByTime(TOOLTIP_SKIP_DELAY_MS + 1);
    const { container } = render(<RecordRow title="a long title" />);
    const title = container.querySelector(".title") as HTMLElement;
    expect(title.hasAttribute("title")).toBe(false);
    Object.defineProperty(title, "scrollWidth", { configurable: true, value: 100 });
    Object.defineProperty(title, "clientWidth", { configurable: true, value: 100 });
    fireEvent.pointerEnter(title);
    act(() => {
      vi.advanceTimersByTime(TOOLTIP_OPEN_DELAY_MS);
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.pointerLeave(title);
    Object.defineProperty(title, "scrollWidth", { configurable: true, value: 200 });
    fireEvent.pointerEnter(title);
    act(() => {
      vi.advanceTimersByTime(TOOLTIP_OPEN_DELAY_MS);
    });
    expect(screen.getByRole("tooltip").textContent).toBe("a long title");
    vi.useRealTimers();
  });
});
