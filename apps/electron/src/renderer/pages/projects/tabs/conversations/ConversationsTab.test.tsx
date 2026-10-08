import { fireEvent, screen } from "@testing-library/react";
import type { ClaudeSession } from "@tesseract/protocol";
import { sampleAgentRun, sampleClaudeSession } from "@tesseract/protocol/fixtures";
import { describe, expect, it } from "vitest";
import { renderTab } from "../kit/testing";
import { ConversationsTab } from "./ConversationsTab";

const session = (patch: Partial<ClaudeSession>): ClaudeSession => ({ ...sampleClaudeSession, projectId: "tesseract", ...patch });

describe("ConversationsTab", () => {
  it("shows the zero count and empty label", () => {
    renderTab(<ConversationsTab projectId="tesseract" sessions={[]} runs={[]} />);
    expect(screen.getByText("No chats about this project yet.")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getByRole("button", { name: "New chat" })).toBeTruthy();
  });

  it("renders sessions with run states and open actions only when there is a target", () => {
    renderTab(
      <ConversationsTab
        projectId="tesseract"
        sessions={[
          session({ sessionId: "s1", title: "Fix the  build", agentRunId: "r1", terminalId: null }),
          session({ sessionId: "s2", title: null, agentRunId: null, terminalId: null, active: false }),
        ]}
        runs={[{ ...sampleAgentRun, id: "r1", state: "running" }]}
      />,
    );
    expect(screen.getByText("Fix the build")).toBeTruthy();
    expect(screen.getByText("Untitled chat")).toBeTruthy();
    expect(screen.getByLabelText("Working")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Open chat" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Open chat" }));
  });
});
