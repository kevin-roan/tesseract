import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test/render";
import { initialsOf, toolSummaryLine } from "./initials";
import { outcomeFor } from "./outcome";
import { OutcomeCard } from "./OutcomeCard";
import { Timeline } from "./Timeline";
import { ToolCallCard } from "./ToolCallCard";
import { UserBubble } from "./UserBubble";

describe("timeline helpers", () => {
  it("derives initials and summary lines", () => {
    expect(initialsOf("You")).toBe("Y");
    expect(initialsOf("ada lovelace byron")).toBe("AL");
    expect(toolSummaryLine("", "first\nsecond")).toBe("first");
    expect(toolSummaryLine("cmd", "x")).toBe("cmd");
  });

  it("maps outcome states with a cancelled fallback", () => {
    expect(outcomeFor("succeeded")).toEqual({ title: "Finished", tone: "success", icon: "success" });
    expect(outcomeFor("failed").title).toBe("Run failed");
    expect(outcomeFor("whatever").title).toBe("Run cancelled");
  });
});

describe("timeline widgets", () => {
  it("toggles tool details", () => {
    renderWithProviders(<ToolCallCard tool="Bash" summary={"ls -la\nmore"} result="boom" status="error" />);
    const header = screen.getByRole("button");
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Input")).toBeNull();
    fireEvent.click(header);
    expect(header.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Input")).toBeTruthy();
    expect(screen.getByText("Result")).toBeTruthy();
    expect(screen.getByText("ls -la")).toBeTruthy();
  });

  it("renders a user bubble and outcome", () => {
    renderWithProviders(
      <>
        <UserBubble text="Hello" time="7h ago" />
        <OutcomeCard {...outcomeFor("failed")} meta="1m · 35k tokens" error="API Error" />
      </>,
    );
    expect(screen.getByText("You")).toBeTruthy();
    expect(screen.getByText("Y")).toBeTruthy();
    expect(screen.getByText("7h ago")).toBeTruthy();
    expect(screen.getByText("Run failed")).toBeTruthy();
    expect(screen.getByText("API Error")).toBeTruthy();
  });

  it("renders header, items and footer", () => {
    renderWithProviders(
      <Timeline header={<span>head</span>} footer={<span>foot</span>}>
        <span key="a">first</span>
        <span key="b">second</span>
      </Timeline>,
    );
    expect(screen.getByText("head")).toBeTruthy();
    expect(screen.getByText("second")).toBeTruthy();
    expect(screen.getByText("foot")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Jump to latest" })).toBeNull();
  });
});
