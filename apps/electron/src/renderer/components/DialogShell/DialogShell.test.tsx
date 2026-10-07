import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DialogShell } from "./DialogShell";
import { openDialogCount } from "./dialog-stack";
import { skipMotionInTests } from "./skip-motion";


let restoreMotion: () => void;
beforeAll(() => {
  restoreMotion = skipMotionInTests();
});
afterAll(() => restoreMotion());

describe("DialogShell", () => {
  it("renders the breadcrumb, body and footer in a modal portal", () => {
    render(
      <DialogShell title="Pair a device" context={{ label: "Sandbox", icon: "sandbox" }} onClose={() => undefined} footerEnd={<button>Go</button>}>
        <p>Body</p>
      </DialogShell>,
    );
    const dialog = screen.getByRole("dialog", { name: "Pair a device" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByTestId("dialog-context").textContent).toBe("Sandbox");
    expect(screen.getByText("Body")).toBeTruthy();
    expect(dialog.closest("[data-dialog-layer]")?.parentElement).toBe(document.body);
  });

  it("hides the context chip for confirm dialogs and when there is no context", () => {
    render(<DialogShell title="Delete?" variant="confirm" context={{ label: "Sandbox" }} onClose={() => undefined} />);
    expect(screen.queryByTestId("dialog-context")).toBeNull();
  });

  it("closes from the close button and Escape", () => {
    const onClose = vi.fn();
    render(<DialogShell title="Title" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("only closes the top dialog on Escape", () => {
    const bottom = vi.fn();
    const top = vi.fn();
    render(
      <>
        <DialogShell title="Bottom" onClose={bottom} />
        <DialogShell title="Top" onClose={top} />
      </>,
    );
    expect(openDialogCount()).toBe(2);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(top).toHaveBeenCalledTimes(1);
    expect(bottom).not.toHaveBeenCalled();
  });

  it("shows the expand button only with onExpand", () => {
    const onExpand = vi.fn();
    render(<DialogShell title="Title" onClose={() => undefined} onExpand={onExpand} />);
    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    expect(onExpand).toHaveBeenCalled();
  });

  it("focuses the first input and submits the form on Enter", () => {
    const onSubmit = vi.fn();
    render(
      <DialogShell title="Form" onClose={() => undefined} onSubmit={onSubmit}>
        <input aria-label="Name" />
      </DialogShell>,
    );
    const input = screen.getByLabelText("Name");
    expect(document.activeElement).toBe(input);
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(onSubmit).toHaveBeenCalled();
  });

  it("keeps focus inside the sheet when the default button is disabled", () => {
    render(
      <>
        <button type="button">Trigger</button>
        <DialogShell title="Pair" onClose={() => undefined} footerEnd={<button type="button" disabled data-dialog-default="">Copy link</button>}>
          <p>Body</p>
        </DialogShell>
      </>,
    );
    expect(document.activeElement).toBe(screen.getByRole("dialog", { name: "Pair" }));
  });

  it("removes the modal after it closes", async () => {
    const { rerender } = render(<DialogShell title="Title" onClose={() => undefined} />);
    rerender(<DialogShell title="Title" open={false} onClose={() => undefined} />);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(openDialogCount()).toBe(0);
  });

  it("renders inline without a portal or key handling", () => {
    const onClose = vi.fn();
    const { container } = render(<DialogShell title="Inline" presentation="inline" onClose={onClose} />);
    expect(container.querySelector("[data-dialog-sheet]")).toBeTruthy();
    expect(document.querySelector("[data-dialog-layer]")).toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
