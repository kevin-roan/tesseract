import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnimatedList, AnimatedListItem } from "../AnimatedList";
import { Reveal } from "../Reveal";
import { Crossfade } from "./Crossfade";
import { Presence } from "./Presence";

describe("motion helpers", () => {
  it("mounts and unmounts Presence and Reveal content", async () => {
    const { rerender } = render(
      <>
        <Presence show>presence</Presence>
        <Reveal open>reveal</Reveal>
      </>,
    );
    expect(screen.getByText("presence")).toBeTruthy();
    expect(screen.getByText("reveal")).toBeTruthy();
    rerender(
      <>
        <Presence show={false}>presence</Presence>
        <Reveal open={false}>reveal</Reveal>
      </>,
    );
    await waitFor(() => {
      expect(screen.queryByText("presence")).toBeNull();
      expect(screen.queryByText("reveal")).toBeNull();
    });
  });

  it("crossfades to the new content", async () => {
    const { rerender } = render(<Crossfade id="a">first</Crossfade>);
    rerender(<Crossfade id="b">second</Crossfade>);
    expect(screen.getByText("second")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("first")).toBeNull());
  });

  it("makes the exiting layer inert and moves focus to the entering one", async () => {
    const { rerender } = render(
      <Crossfade id="a">
        <button type="button">first</button>
      </Crossfade>,
    );
    screen.getByText("first").focus();
    rerender(
      <Crossfade id="b">
        <button type="button">second</button>
      </Crossfade>,
    );
    const exiting = screen.queryByText("first")?.parentElement;
    if (exiting) {
      expect(exiting.hasAttribute("inert")).toBe(true);
      expect(exiting.getAttribute("aria-hidden")).toBe("true");
    }
    expect(screen.getByText("second").parentElement?.contains(document.activeElement)).toBe(true);
    await waitFor(() => expect(screen.queryByText("first")).toBeNull());
  });

  it("adds and removes list items", async () => {
    const list = (rows: string[]) => (
      <AnimatedList>
        {rows.map((row) => (
          <AnimatedListItem key={row}>{row}</AnimatedListItem>
        ))}
      </AnimatedList>
    );
    const { rerender } = render(list(["a", "b"]));
    rerender(list(["c", "a"]));
    expect(screen.getByText("c")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("b")).toBeNull());
  });
});
