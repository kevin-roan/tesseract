import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SECTION_GAP } from "./constants";
import { PageBody } from "./PageBody";

describe("PageBody", () => {
  it("uses the section gap by default", () => {
    const { container } = render(<PageBody>content</PageBody>);
    const page = container.querySelector(".page") as HTMLElement;
    expect(page.style.gap).toBe(`${SECTION_GAP}px`);
    expect(page.className).not.toContain("clamped");
  });

  it("clamps the column to maxWidth and accepts a custom gap", () => {
    const { container } = render(
      <PageBody gap={0} maxWidth={720} label="Project">
        content
      </PageBody>,
    );
    const page = container.querySelector(".page") as HTMLElement;
    expect(page.style.maxWidth).toBe("720px");
    expect(Number.parseFloat(page.style.gap)).toBe(0);
    expect(page.className).toContain("clamped");
    expect(container.querySelector("[role=region]")?.getAttribute("aria-label")).toBe("Project");
  });
});
