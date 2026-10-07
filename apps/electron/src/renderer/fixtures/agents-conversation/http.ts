import { routePatterns, type AgentRun, type StartAgentRun } from "@theone/protocol";
import { parityConversationDetail } from "../agents/gtk-parity";
import { isScenario } from "../scenario";
import { isGtkParity } from "../shell/parity";
import { defineHttpFixtures, FixtureReply, reply } from "../types";
import { CONVERSATION_THUMBNAIL_SVG, conversationDetail } from "./data";

export const SCENARIOS = {
  loadError: "conversation-load-error",
  followUpError: "conversation-follow-up-error",
  stopError: "conversation-stop-error",
} as const;

const rest = routePatterns.rest;
const notFound = () => reply(404, { error: { code: "not_found", message: "Agent run not found" } });
const unavailable = (message: string) => reply(503, { error: { code: "unavailable", message } });

export default defineHttpFixtures([
  {
    method: "GET",
    path: rest.agentRun,
    respond: ({ params }) => {
      if (isScenario(SCENARIOS.loadError)) return unavailable("The controller is restarting");
      if (isGtkParity()) return parityConversationDetail(params[0] ?? "") ?? notFound();
      return conversationDetail(params[0] ?? "") ?? notFound();
    },
  },
  {
    method: "DELETE",
    path: rest.agentRun,
    respond: ({ params }) => {
      if (isScenario(SCENARIOS.stopError)) return unavailable("Claude did not respond to the stop signal");
      const detail = conversationDetail(params[0] ?? "");
      if (!detail) return notFound();
      const { events: _events, ...run } = detail;
      return { ...run, state: "cancelled", endedAt: new Date().toISOString() } satisfies AgentRun;
    },
  },
  {
    method: "POST",
    path: rest.agentRuns,
    respond: ({ body }) => {
      if (isScenario(SCENARIOS.followUpError)) return unavailable("Claude is busy with another run");
      const request = body as StartAgentRun;
      const run: AgentRun = {
        id: `run_conv_${Date.now().toString(36)}`,
        projectId: request.projectId ?? null,
        prompt: request.prompt,
        mode: null,
        attachments: [],
        sessionId: request.resumeSessionId ?? null,
        claudeAccountId: "claude-work",
        state: "running",
        startedAt: new Date().toISOString(),
        endedAt: null,
        usage: null,
        result: null,
        error: null,
        archivedAt: null,
      };
      return run;
    },
  },
  {
    method: "GET",
    path: rest.uploadContent,
    respond: () => new FixtureReply(200, CONVERSATION_THUMBNAIL_SVG, "image/svg+xml"),
  },
]);
