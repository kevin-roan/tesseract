import { MotionGlobalConfig } from "motion/react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Row } from "../Row";
import { KeyedList } from "./KeyedList";

MotionGlobalConfig.skipAnimations = true;

describe("KeyedList", () => {
  it("renders nothing when empty", () => {
    const { container } = render(<KeyedList items={[]} getKey={(item: string) => item} renderItem={(item) => item} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders items in order with list semantics", () => {
    const { getByRole, getAllByRole, rerender } = render(
      <KeyedList label="Files" items={["a", "b", "c"]} getKey={(item) => item} renderItem={(item) => <span>{item}</span>} />,
    );
    expect(getByRole("list", { name: "Files" })).toBeTruthy();
    expect(getAllByRole("listitem").map((item) => item.textContent)).toEqual(["a", "b", "c"]);
    rerender(<KeyedList label="Files" items={["c", "a", "b"]} getKey={(item) => item} renderItem={(item) => <span>{item}</span>} />);
    expect(getAllByRole("listitem").map((item) => item.textContent)).toEqual(["c", "a", "b"]);
  });

  it("passes the divided flag to rows", () => {
    const { container } = render(<KeyedList divided items={["a"]} getKey={(item) => item} renderItem={(item) => <Row>{item}</Row>} />);
    expect(container.querySelector(".list")?.className).toContain("divided");
    expect(container.querySelector(".row")?.className).toContain("divided");
  });
});
