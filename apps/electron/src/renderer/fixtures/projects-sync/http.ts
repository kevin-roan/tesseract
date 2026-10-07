import type { SyncDiscard, SyncRequest } from "@theone/protocol";
import { routePatterns } from "@theone/protocol";
import { GTK_PARITY } from "../projects/parity";
import { currentScenario, isScenario } from "../scenario";
import { defineHttpFixtures, reply } from "../types";
import { FIXTURE_CHANGES, FIXTURE_REQUESTS, parityChanges } from "./data";

export const SCENARIOS = {
  syncError: "sync-error",
  discardFails: "sync-discard-error",
} as const;

const rest = routePatterns.rest;
const projectId = (params: string[]) => params[0] ?? "";
const changesById = () => (isScenario(GTK_PARITY) ? parityChanges() : FIXTURE_CHANGES);
const requestsById = (): Readonly<Record<string, SyncRequest[]>> => (isScenario(GTK_PARITY) ? {} : FIXTURE_REQUESTS);

export default defineHttpFixtures([
  {
    method: "GET",
    path: rest.projectSyncChanges,
    respond: ({ params }) => {
      if (currentScenario() === SCENARIOS.syncError) return reply(503, { error: { code: "unavailable", message: "The sync service is restarting" } });
      return changesById()[projectId(params)] ?? reply(404, { error: { code: "not_found", message: "Project not found" } });
    },
  },
  { method: "GET", path: rest.projectSyncRequests, respond: ({ params }) => requestsById()[projectId(params)] ?? [] },
  {
    method: "POST",
    path: rest.projectSyncDiscard,
    respond: ({ params, body }) => {
      if (currentScenario() === SCENARIOS.discardFails) return reply(500, { error: { code: "internal", message: "Disk full" } });
      const changes = changesById()[projectId(params)];
      const paths = (body as SyncDiscard | undefined)?.paths ?? [];
      return { discarded: paths, unavailable: [], backupPath: "/workspace/.sync-backups/discard-1", changes };
    },
  },
  {
    method: "POST",
    path: rest.syncRequestCancel,
    respond: ({ params }) => {
      const found = Object.values(FIXTURE_REQUESTS)
        .flat()
        .find((request) => request.id === params[0]);
      return found ? { ...found, status: "cancelled" } : reply(404, { error: { code: "not_found", message: "Request not found" } });
    },
  },
]);
