import type { SyncRequest } from "@tesseract/protocol";
import { GTK_PARITY } from "../projects/parity";
import { isScenario } from "../scenario";
import { defineIpcFixtures } from "../types";
import { FIXTURE_HOST_CHANGES, FIXTURE_LINKS, FIXTURE_SNAPSHOTS, parityLinks, fixtureDiff } from "./data";

const parity = () => isScenario(GTK_PARITY);

export default defineIpcFixtures({
  syncback: {
    links: () => (parity() ? parityLinks() : FIXTURE_LINKS),
    snapshots: (projectId) => (parity() ? [] : (FIXTURE_SNAPSHOTS[projectId] ?? [])),
    hostChanges: (projectId) => FIXTURE_HOST_CHANGES[projectId] ?? [],
    diff: (_projectId, path) => fixtureDiff(path),
    submit: (projectId, kind, options): SyncRequest => {
      const now = new Date().toISOString();
      return {
        id: "sync_f1xtur3000",
        projectId,
        kind,
        status: "pending",
        paths: options.paths ?? null,
        force: options.force ?? false,
        source: "desktop",
        claimedBy: null,
        result: null,
        error: null,
        createdAt: now,
        updatedAt: now,
      };
    },
  },
});
