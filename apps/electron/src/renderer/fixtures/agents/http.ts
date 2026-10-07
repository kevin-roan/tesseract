import type { AgentRun, InboxItem } from "@theone/protocol";
import { routePatterns } from "@theone/protocol";
import { sampleClaudeSession, sampleInbox } from "@theone/protocol/fixtures";
import { currentScenario } from "../scenario";
import { PARITY_GATES } from "../shell/gates";
import { GTK_PARITY, isGtkParity, pending } from "../shell/parity";
import { defineHttpFixtures, reply, type HttpFixtureRequest } from "../types";
import { parityAgentsLoading, parityArchivedRuns, parityRuns, paritySessions } from "./gtk-parity";
import {
  fixtureAgentRuns,
  fixtureArchivedRuns,
  fixtureAttentionItems,
  fixtureRunningRun,
  fixtureTerminalSession,
  minutesAgo,
} from "./data";

export const SCENARIOS = {
  list: "agents-list",
  attention: "agents-attention",
  empty: "agents-empty",
  archiveEmpty: "agents-archive-empty",
  error: "agents-error",
} as const;

const rest = routePatterns.rest;

const OWN_SCENARIOS: readonly string[] = [...Object.values(SCENARIOS), GTK_PARITY];

interface AgentsWorld {
  scenario: string | null;
  runs: AgentRun[];
  archived: AgentRun[];
  items: InboxItem[];
}

let world: AgentsWorld | null = null;

function seed(scenario: string | null): AgentsWorld {
  if (isGtkParity()) return { scenario, runs: parityRuns(), archived: parityArchivedRuns(), items: [] };
  const attention = scenario === SCENARIOS.attention;
  const empty = scenario === SCENARIOS.empty;
  return {
    scenario,
    runs: empty ? [] : attention ? [fixtureRunningRun, ...fixtureAgentRuns] : [...fixtureAgentRuns],
    archived: empty || scenario === SCENARIOS.archiveEmpty ? [] : [...fixtureArchivedRuns],
    items: attention ? [...fixtureAttentionItems] : OWN_SCENARIOS.includes(scenario ?? "") ? [] : [...sampleInbox.items],
  };
}

function state(): AgentsWorld {
  const scenario = currentScenario();
  if (!world || world.scenario !== scenario) world = seed(scenario);
  return world;
}

export function resetAgentsFixtures(): void {
  world = null;
}

const counts = (items: readonly InboxItem[]) => {
  const unread = items.filter((item) => !item.readAt);
  return {
    unreadCount: unread.length,
    attentionCount: unread.filter((item) => item.kind === "needs_input" || item.kind === "permission").length,
  };
};

type IdsBody = { ids?: string[]; all?: boolean; archived?: boolean };

function selectIds(source: readonly AgentRun[], body: IdsBody): string[] {
  if (body.ids) return body.ids;
  return source.filter((run) => run.state !== "running").map((run) => run.id);
}

function archive({ body }: HttpFixtureRequest) {
  const world = state();
  const request = (body ?? {}) as IdsBody;
  const toArchive = request.archived !== false;
  const from = toArchive ? world.runs : world.archived;
  const ids = new Set(selectIds(from, request));
  const moved = from.filter((run) => ids.has(run.id) && run.state !== "running");
  const stamp = toArchive ? minutesAgo(0) : null;
  if (toArchive) {
    world.runs = world.runs.filter((run) => !ids.has(run.id));
    world.archived = [...moved.map((run) => ({ ...run, archivedAt: stamp })), ...world.archived];
  } else {
    world.archived = world.archived.filter((run) => !ids.has(run.id));
    world.runs = [...moved.map((run) => ({ ...run, archivedAt: null })), ...world.runs];
  }
  return { count: moved.length };
}

function remove({ body }: HttpFixtureRequest) {
  const world = state();
  const request = (body ?? {}) as IdsBody;
  const source = request.all ? (request.archived ? world.archived : world.runs) : [...world.runs, ...world.archived];
  const ids = new Set(selectIds(source, request));
  const before = world.runs.length + world.archived.length;
  world.runs = world.runs.filter((run) => !ids.has(run.id) || run.state === "running");
  world.archived = world.archived.filter((run) => !ids.has(run.id));
  return { count: before - world.runs.length - world.archived.length };
}

export default defineHttpFixtures([
  ...PARITY_GATES,
  {
    method: "GET",
    path: rest.agentRuns,
    respond: ({ query }) => {
      if (parityAgentsLoading()) return pending();
      const world = state();
      if (world.scenario === SCENARIOS.error) return reply(503, { error: { code: "unavailable", message: "Controller is restarting" } });
      const archived = query.get("archived");
      return archived === "1" || archived === "true" ? world.archived : world.runs;
    },
  },
  { method: "POST", path: rest.agentRunsArchive, respond: archive },
  { method: "POST", path: rest.agentRunsDelete, respond: remove },
  {
    method: "GET",
    path: rest.inbox,
    respond: () => {
      const items = state().items;
      return { items, ...counts(items) };
    },
  },
  {
    method: "POST",
    path: rest.inboxRead,
    respond: ({ body }) => {
      const world = state();
      const ids = new Set(((body ?? {}) as { ids?: string[] }).ids ?? []);
      world.items = world.items.filter((item) => !ids.has(item.id));
      return counts(world.items);
    },
  },
  {
    method: "GET",
    path: rest.sessions,
    respond: ({ query }) => {
      if (isGtkParity()) return paritySessions(query.get("projectId"));
      const scenario = state().scenario;
      if (scenario === SCENARIOS.attention) return [fixtureTerminalSession];
      return OWN_SCENARIOS.includes(scenario ?? "") ? [] : [sampleClaudeSession];
    },
  },
]);
