import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PropertyChip } from "./PropertyChip";
import { truncateChars } from "./truncate";

describe("truncateChars", () => {
  it("keeps short labels and ellipsizes long ones", () => {
    expect(truncateChars("main", 10)).toBe("main");
    expect(truncateChars("feature/very-long-branch", 8)).toBe("feature…");
    expect(truncateChars("anything", undefined)).toBe("anything");
  });
});

describe("PropertyChip", () => {
  it("renders the label and hides when empty", () => {
    const { container, rerender } = render(<PropertyChip label="Confidential" icon="confidential" color="warning" />);
    expect(screen.getByText("Confidential")).toBeTruthy();
    rerender(<PropertyChip label="" />);
    expect(container.textContent).toBe("");
  });
});
