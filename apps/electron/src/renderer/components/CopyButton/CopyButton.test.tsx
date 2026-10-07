import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "./CopyButton";

describe("CopyButton", () => {
  const writeText = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    writeText.mockClear();
  });

  it("copies the raw text and reverts the label after 1500ms", async () => {
    render(<CopyButton text={"raw\ncode"} copyLabel="Copy" copiedLabel="Copied to clipboard" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    });
    expect(writeText).toHaveBeenCalledWith("raw\ncode");
    expect(screen.getByRole("button", { name: "Copied to clipboard" })).toBeTruthy();
    expect(screen.getByRole("button").querySelector("[aria-live='polite']")?.textContent).toBe("Copied to clipboard");
    act(() => vi.advanceTimersByTime(1000));
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("button", { name: "Copied to clipboard" })).toBeTruthy();
    act(() => vi.advanceTimersByTime(600));
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    expect(screen.getByRole("button").hasAttribute("title")).toBe(false);
  });

  it("keeps the copy label when the clipboard write fails", async () => {
    writeText.mockImplementationOnce(() => Promise.reject(new Error("denied")));
    Object.defineProperty(document, "execCommand", { value: () => false, configurable: true });
    render(<CopyButton text="x" copyLabel="Copy" copiedLabel="Copied" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    });
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
  });
});
