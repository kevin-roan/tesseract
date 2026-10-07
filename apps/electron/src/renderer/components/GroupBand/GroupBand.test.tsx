import { MotionGlobalConfig } from "motion/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GroupBand } from "./GroupBand";
import { ListGroup } from "./ListGroup";

MotionGlobalConfig.skipAnimations = true;

describe("GroupBand", () => {
  it("shows a zero count but hides a missing one", () => {
    const { rerender, container } = render(<GroupBand title="Builds" count={0} />);
    expect(container.textContent).toBe("Builds0");
    rerender(<GroupBand title="Builds" count={null} />);
    expect(container.textContent).toBe("Builds");
  });

  it("renders the trailing action with its label", () => {
    const onAction = vi.fn();
    render(<GroupBand title="Chats" actionLabel="New chat" onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it("shows the subtitle instead of the spacer", () => {
    const { container } = render(<GroupBand title="Ports" subtitle="Servers started from this project" />);
    expect(container.querySelector(".subtitle")?.textContent).toBe("Servers started from this project");
    expect(container.querySelector(".spacer")).toBeNull();
  });
});

describe("ListGroup", () => {
  it("switches between loading, empty and content", async () => {
    const { rerender, container } = render(
      <ListGroup title="Commits" loading loadingLabel="Loading commits" emptyLabel="No commits yet.">
        <span>row</span>
      </ListGroup>,
    );
    expect(screen.getByRole("status", { name: "Loading commits" })).toBeTruthy();
    rerender(
      <ListGroup title="Commits" empty emptyLabel="No commits yet.">
        <span>row</span>
      </ListGroup>,
    );
    await waitFor(() => expect(container.querySelector("[data-view]")?.getAttribute("data-view")).toBe("empty"));
    expect(screen.getByText("No commits yet.")).toBeTruthy();
    rerender(
      <ListGroup title="Commits" emptyLabel="No commits yet.">
        <span>row</span>
      </ListGroup>,
    );
    await waitFor(() => expect(screen.getByText("row")).toBeTruthy());
  });
});
