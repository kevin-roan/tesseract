import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Titlebar } from "./Titlebar";

describe("Titlebar", () => {
  it("adds the divider only between end widgets and the window controls", () => {
    const { container, rerender } = render(<Titlebar start="Title" end={<button type="button">a</button>} controls={<span data-testid="controls" />} />);
    expect(container.querySelector(".separator")).not.toBeNull();
    rerender(<Titlebar start="Title" controls={<span data-testid="controls" />} />);
    expect(container.querySelector(".separator")).toBeNull();
    rerender(<Titlebar start="Title" end={<button type="button">a</button>} controls={false} />);
    expect(container.querySelector(".separator")).toBeNull();
  });

  it("is a drag region with the page divider and sidebar padding variants", () => {
    const { container, rerender } = render(<Titlebar divider controls={false} />);
    const header = container.querySelector("header")!;
    expect(header.className).toContain("to-drag");
    expect(header.className).toContain("divided");
    expect(header.className).not.toContain("inset");
    rerender(<Titlebar variant="sidebar" controls={false} backdrop />);
    expect(header.className).toContain("sidebar");
    expect(header.className).toContain("inset");
    expect(header.hasAttribute("data-backdrop")).toBe(true);
  });
});

describe("Titlebar on macOS", () => {
  it("leaves no dangling divider when the native traffic lights replace window controls", async () => {
    const { runtime } = await import("../../app/runtime");
    const previous = runtime.platform;
    Object.assign(runtime, { platform: "darwin" });
    try {
      const { container } = render(<Titlebar start="Title" end={<button type="button">a</button>} />);
      expect(container.querySelector(".separator")).toBeNull();
    } finally {
      Object.assign(runtime, { platform: previous });
    }
  });
});
