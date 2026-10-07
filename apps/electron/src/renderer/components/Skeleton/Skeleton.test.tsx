import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SKELETON_ROW_COUNT } from "./constants";
import { Skeleton } from "./Skeleton";
import { SkeletonRows } from "./SkeletonRows";

describe("Skeleton", () => {
  it("renders a circle with equal sides", () => {
    const { container } = render(<Skeleton shape="circle" width={16} />);
    const bone = container.firstElementChild as HTMLElement;
    expect(bone.style.width).toBe("16px");
    expect(bone.style.height).toBe("16px");
    expect(bone.className).toContain("circle");
    expect(bone.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders the default number of placeholder rows as a busy status", () => {
    const { container } = render(<SkeletonRows label="Loading images" />);
    expect(screen.getByRole("status", { name: "Loading images" })).toBeTruthy();
    expect(container.querySelectorAll(".row")).toHaveLength(SKELETON_ROW_COUNT);
  });

  it("can omit the icon and meta bones", () => {
    const { container } = render(<SkeletonRows rows={1} icon={false} meta={false} />);
    expect(container.querySelectorAll(".bone")).toHaveLength(1);
  });
});
