import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "../ProgressBar";
import { arcDash, clampFraction, percentText, ringGeometry } from "./geometry";
import { ProgressRing } from "./ProgressRing";

describe("ProgressRing", () => {
  it("draws the arc from 12 o'clock with a centered percent label", () => {
    const { container } = render(<ProgressRing progress={0.62} label="Upload" />);
    const ring = screen.getByRole("progressbar", { name: "Upload" });
    expect(ring.getAttribute("aria-valuenow")).toBe("62");
    expect(screen.getByText("62%")).toBeTruthy();
    const arc = container.querySelectorAll("circle")[1];
    expect(arc?.getAttribute("transform")).toBe("rotate(-90 20 20)");
    expect(arc?.getAttribute("r")).toBe("18.5");
    expect(arc?.getAttribute("stroke-dasharray")).toBe("62 100");
  });

  it("hides the label on request and clamps values", () => {
    render(<ProgressRing progress={2} showLabel={false} />);
    expect(screen.queryByText("100%")).toBeNull();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
  });

  it("has pure geometry helpers", () => {
    expect(clampFraction(null)).toBe(0);
    expect(clampFraction(Number.NaN)).toBe(0);
    expect(percentText(0.005)).toBe("1%");
    expect(ringGeometry(40, 3)).toEqual({ center: 20, radius: 18.5 });
    expect(arcDash(0.25)).toBe("25 100");
  });
});

describe("ProgressBar", () => {
  it("accepts a color override and renders indeterminate state", () => {
    const { container, rerender } = render(<ProgressBar progress={0.3} color="accent" label="Build" />);
    expect(screen.getByRole("progressbar", { name: "Build" }).getAttribute("style")).toContain("var(--to-accent)");
    rerender(<ProgressBar progress={null} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBeNull();
    expect(container.querySelector(".indeterminate")).toBeTruthy();
  });
});
