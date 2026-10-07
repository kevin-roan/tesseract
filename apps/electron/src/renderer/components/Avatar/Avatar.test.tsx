import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "./Avatar";
import { initialsOf } from "./initials";

describe("initialsOf", () => {
  it("takes the first letter of up to two words", () => {
    expect(initialsOf("Kevin Roan")).toBe("KR");
    expect(initialsOf("  mona lisa vito ")).toBe("ML");
    expect(initialsOf("ada")).toBe("A");
    expect(initialsOf("")).toBe("");
  });
});

describe("Avatar", () => {
  it("renders initials in a sized circle", () => {
    render(<Avatar name="Kai Rivera" />);
    const avatar = screen.getByRole("img", { name: "Kai Rivera" });
    expect(avatar.style.width).toBe("28px");
    expect(avatar.textContent).toBe("KR");
  });

  it("supports named and numeric sizes", () => {
    const { rerender } = render(<Avatar name="A" size="sm" />);
    expect(screen.getByRole("img").style.width).toBe("20px");
    rerender(<Avatar name="A" size={36} />);
    expect(screen.getByRole("img").style.width).toBe("36px");
  });

  it("drops a broken image and keeps the initials", () => {
    const { container } = render(<Avatar name="Kai Rivera" src="broken.png" />);
    const image = container.querySelector("img");
    expect(image).toBeTruthy();
    if (image) fireEvent.error(image);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("KR")).toBeTruthy();
  });
});
