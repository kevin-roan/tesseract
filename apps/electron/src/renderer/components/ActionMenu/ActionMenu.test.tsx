import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActionMenu } from "./ActionMenu";
import { computeFloatingPosition, hasMenuEntries, pointAnchor } from "./model";
import { useActionMenu, useContextMenu } from "./use-action-menu";

function Harness({ onRename, empty = false }: { onRename(): void; empty?: boolean }) {
  const menu = useActionMenu();
  const context = useContextMenu(menu.openAt);
  const sections = empty ? [[], []] : [[{ label: "Rename", onSelect: onRename }], [], [{ label: "Delete", danger: true, onSelect: vi.fn() }]];
  return (
    <>
      <div data-testid="target" tabIndex={0} {...context} />
      <ActionMenu anchor={menu.anchor} sections={sections} onClose={menu.close} ariaLabel="Row" />
    </>
  );
}

describe("ActionMenu model", () => {
  it("detects empty sections", () => {
    expect(hasMenuEntries([[], []])).toBe(false);
    expect(hasMenuEntries([[], [{ label: "a", onSelect: () => undefined }]])).toBe(true);
  });

  it("opens below the anchor and flips above near the bottom edge", () => {
    const base = { width: 100, height: 80, viewportWidth: 400, viewportHeight: 300, offset: 4, margin: 8 };
    expect(computeFloatingPosition({ ...base, anchor: pointAnchor(20, 20) })).toEqual({ left: 20, top: 25, placement: "below" });
    expect(computeFloatingPosition({ ...base, anchor: pointAnchor(380, 280) })).toEqual({ left: 292, top: 196, placement: "above" });
  });
});

describe("ActionMenu", () => {
  it("opens on right-click with one separator between non-empty sections and runs the entry", () => {
    const onRename = vi.fn();
    render(<Harness onRename={onRename} />);
    fireEvent.contextMenu(screen.getByTestId("target"), { clientX: 10, clientY: 12 });
    expect(screen.getByRole("menu", { name: "Row" })).toBeTruthy();
    expect(screen.getAllByRole("separator")).toHaveLength(1);
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(onRename).toHaveBeenCalledTimes(1);
  });

  it("opens from the keyboard menu shortcut and closes on Escape", async () => {
    render(<Harness onRename={vi.fn()} />);
    fireEvent.keyDown(screen.getByTestId("target"), { key: "F10", shiftKey: true });
    expect(screen.getByRole("menu")).toBeTruthy();
    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    await vi.waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("stays closed when every section is empty", () => {
    render(<Harness onRename={vi.fn()} empty />);
    fireEvent.contextMenu(screen.getByTestId("target"));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
