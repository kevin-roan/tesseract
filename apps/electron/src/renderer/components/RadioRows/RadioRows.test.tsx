import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsGroup } from "../PreferenceRows";
import { THEME_CHOICES } from "./gallery-samples";
import { RadioRows } from "./RadioRows";

describe("RadioRows", () => {
  it("selects by clicking anywhere on the row, but never re-fires for the current value", () => {
    const onSelect = vi.fn();
    render(
      <SettingsGroup title="Theme" listRole="radiogroup">
        <RadioRows choices={THEME_CHOICES} value="dark" onSelect={onSelect} />
      </SettingsGroup>,
    );
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeTruthy();
    fireEvent.click(screen.getByText("Dark panels with light text"));
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Light"));
    expect(onSelect).toHaveBeenCalledWith("light");
  });

  it("disables rows while busy or when unavailable", () => {
    const onSelect = vi.fn();
    const choices = THEME_CHOICES.map((choice) => (choice.id === "light" ? { ...choice, available: false } : choice));
    const { rerender } = render(<RadioRows choices={choices} value="dark" onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Light"));
    expect(onSelect).not.toHaveBeenCalled();
    rerender(<RadioRows choices={THEME_CHOICES} value="dark" onSelect={onSelect} busy />);
    fireEvent.click(screen.getByText("System"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("moves with arrow keys", () => {
    const onSelect = vi.fn();
    render(<RadioRows choices={THEME_CHOICES} value="system" onSelect={onSelect} />);
    const radios = screen.getAllByRole("radio");
    expect(radios[0]?.getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(radios[0] as HTMLElement, { key: "ArrowDown" });
    expect(onSelect).toHaveBeenCalledWith("light");
  });
});
