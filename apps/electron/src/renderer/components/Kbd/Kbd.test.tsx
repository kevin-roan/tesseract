import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Kbd } from "./Kbd";

describe("Kbd", () => {
  it("renders one cap per key with an accessible label", () => {
    const { container } = render(<Kbd keys="CmdOrCtrl+Shift+P" platform="darwin" />);
    const root = container.querySelector("kbd");
    expect(root?.getAttribute("aria-label")).toBe("⇧+⌘+P");
    expect(root?.querySelectorAll("kbd")).toHaveLength(3);
  });

  it("joins plain keys with the platform separator", () => {
    const linux = render(<Kbd keys="Ctrl+K" variant="plain" platform="linux" />);
    expect(linux.container.textContent).toBe("Ctrl+K");
    const mac = render(<Kbd keys="CmdOrCtrl+K" variant="plain" platform="darwin" />);
    expect(mac.container.textContent).toBe("⌘K");
  });

  it("renders nothing for an empty accelerator", () => {
    const { container } = render(<Kbd keys="" />);
    expect(container.innerHTML).toBe("");
  });
});
