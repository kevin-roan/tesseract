import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ICONS } from "../../theme/icons";
import { Icon } from "./Icon";

describe("Icon", () => {
  it("renders mapped icons at 16px with stroke 2 by default", () => {
    const { container } = render(<Icon name="refresh" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("16");
    expect(svg?.getAttribute("stroke-width")).toBe("2");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("maps named sizes and semantic colors", () => {
    const { container } = render(<Icon name="sandbox" size="2xl" color="text-tertiary" label="Sandbox" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("48");
    expect(svg?.getAttribute("style")).toContain("var(--to-text-tertiary)");
    expect(svg?.getAttribute("aria-label")).toBe("Sandbox");
  });

  it("covers the spec aliases with shared glyphs", () => {
    expect(ICONS.projects).toBe(ICONS.sandbox);
    expect(ICONS.sync).toBe(ICONS["sync-from-host"]);
    expect(ICONS.success).toBe(ICONS["status-done"]);
    expect(ICONS.expand).toBe(ICONS["caret-down"]);
  });
});
