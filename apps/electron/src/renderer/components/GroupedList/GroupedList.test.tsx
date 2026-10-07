import { MotionGlobalConfig } from "motion/react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GroupedList } from "./GroupedList";

MotionGlobalConfig.skipAnimations = true;

const GROUPS = [
  { key: "a", title: "Alpha", items: ["one", "two"] },
  { key: "b", title: "Beta", items: ["three"] },
];

describe("GroupedList", () => {
  it("renders a counted band per group with its rows in order", () => {
    const { container } = render(<GroupedList groups={GROUPS} getKey={(item) => item} renderItem={(item) => <span>{item}</span>} />);
    expect(Array.from(container.querySelectorAll("h3")).map((node) => node.textContent)).toEqual(["Alpha", "Beta"]);
    expect(screen.getByRole("list", { name: "Alpha" }).textContent).toBe("onetwo");
    expect(container.textContent).toContain("Alpha2");
  });
});
