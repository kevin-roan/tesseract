import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Banner } from "./Banner";

describe("Banner", () => {
  it("renders the title, tone and button", () => {
    const onButton = vi.fn();
    render(<Banner title="Can't reach the sandbox" tone="danger" buttonLabel="Retry" onButton={onButton} />);
    const banner = screen.getByRole("alert");
    expect(banner.getAttribute("data-tone")).toBe("danger");
    expect(banner.className).toContain("danger");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onButton).toHaveBeenCalledTimes(1);
  });

  it("hides the button without a label and uses status for neutral tones", () => {
    render(<Banner title="Looking for the sandbox…" tone="info" />);
    expect(screen.getByRole("status").textContent).toBe("Looking for the sandbox…");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders nothing when not revealed", () => {
    const { container } = render(<Banner title="Hidden" revealed={false} />);
    expect(container.textContent).toBe("");
  });
});
