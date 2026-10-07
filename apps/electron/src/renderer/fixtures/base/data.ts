import type { AgentRun, Project, SandboxStatus } from "@theone/protocol";
import {
  sampleAgentRun,
  sampleProject,
  sampleStatus,
} from "@theone/protocol/fixtures";

export const FIXTURE_NOW = "2026-09-23T23:16:00.000Z";
export const FIXTURE_API_URL = "http://127.0.0.1:7700";
export const FIXTURE_TOKEN = "fixture-token";
export const FIXTURE_SANDBOX = "theone-sandbox";
export const FIXTURE_SIDEBAR_WIDTH = 305;

const project = (id: string, framework: Project["framework"], confidential = false): Project => ({
  ...sampleProject,
  id,
  name: id,
  path: `/workspace/projects/${id}`,
  framework,
  confidential,
});

export const fixtureProjects: Project[] = [
  project("streaxfit", "expo", true),
  project("monolith", "node"),
  project("hybrid-pos", "next"),
  project("sante-production", "vite"),
];

export const fixtureRuns: AgentRun[] = [
  { ...sampleAgentRun, id: "run_fixture_1", projectId: "monolith", state: "succeeded", prompt: "Write the architecture notes", endedAt: FIXTURE_NOW },
  { ...sampleAgentRun, id: "run_fixture_2", projectId: null, state: "succeeded", prompt: "Summarise the logs", endedAt: FIXTURE_NOW },
];

export const fixtureStatus: SandboxStatus = {
  ...sampleStatus,
  uptimeSec: 7 * 3600 + 45 * 60,
  counts: { ...sampleStatus.counts, projects: fixtureProjects.length },
};
