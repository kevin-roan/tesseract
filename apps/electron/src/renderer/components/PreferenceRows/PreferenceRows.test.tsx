import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ButtonRow } from "./ButtonRow";
import { EntryRow } from "./EntryRow";
import { ExpanderRow } from "./ExpanderRow";
import { PropertyRow } from "./PropertyRow";
import { SettingsGroup } from "./SettingsGroup";
import { SwitchRow } from "./SwitchRow";

describe("SettingsGroup", () => {
  it("renders only the header when it has no rows", () => {
    const { container } = render(<SettingsGroup title="Empty" description="Nothing here" />);
    expect(screen.getByText("Empty")).toBeTruthy();
    expect(container.querySelector(".list")).toBeNull();
  });
});

describe("rows", () => {
  it("submits an entry row on Enter", () => {
    const onActivate = vi.fn();
    render(
      <SettingsGroup>
        <EntryRow title="API URL" value="http://x" onChange={vi.fn()} onActivate={onActivate} />
      </SettingsGroup>,
    );
    fireEvent.keyDown(screen.getByRole("textbox", { name: "API URL" }), { key: "Enter" });
    expect(onActivate).toHaveBeenCalledWith("http://x");
  });

  it("toggles a switch row from the row and from the switch exactly once", () => {
    const onChange = vi.fn();
    render(<SwitchRow title="Start with Tesseract" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByText("Start with Tesseract"));
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("switch", { name: "Start with Tesseract" }));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it("does not toggle a disabled switch row", () => {
    const onChange = vi.fn();
    render(<SwitchRow title="Serve" checked onChange={onChange} disabled />);
    fireEvent.click(screen.getByText("Serve"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("runs the button row action", () => {
    const onActivate = vi.fn();
    render(<ButtonRow title="Forget this sandbox" label="Forget" variant="destructive" onActivate={onActivate} />);
    fireEvent.click(screen.getByRole("button", { name: "Forget" }));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("shows property rows with the value", () => {
    render(<PropertyRow title="Image" value="ghcr.io/tesseract/sandbox:latest" />);
    expect(screen.getByText("ghcr.io/tesseract/sandbox:latest")).toBeTruthy();
  });

  it("expands and collapses", async () => {
    render(
      <ExpanderRow title="Log">
        <PropertyRow nested title="Last" value="line" />
      </ExpanderRow>,
    );
    const header = screen.getByRole("button", { name: "Log" });
    expect(screen.queryByText("line")).toBeNull();
    fireEvent.click(header);
    expect(header.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("line")).toBeTruthy();
    await act(async () => {
      fireEvent.keyDown(header, { key: "Enter" });
    });
    expect(header.getAttribute("aria-expanded")).toBe("false");
  });
});
