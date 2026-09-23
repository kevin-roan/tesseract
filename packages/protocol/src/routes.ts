import { API_PREFIX, UI_PREFIX } from "./constants";
import { buildFragment, buildQuery } from "./url";

export type ProjectFilter = { projectId?: string };
export type LogTail = { tail?: number };
export type TicketParam = { ticket?: string };
export type TerminalPageParams = { ticket: string; session: string };
export type VncPageParams = { ticket: string; password?: string | null };

const segment = (value: string) => encodeURIComponent(value);
const api = (path: string) => `${API_PREFIX}${path}`;

export const restPaths = {
  health: () => api("/health"),
  authTicket: () => api("/auth/ticket"),
  status: () => api("/status"),
  context: () => api("/context"),
  projects: () => api("/projects"),
  project: (id: string) => api(`/projects/${segment(id)}`),
  projectGit: (id: string) => api(`/projects/${segment(id)}/git`),
  processes: (query?: ProjectFilter) => api(`/processes${buildQuery(query)}`),
  process: (id: string) => api(`/processes/${segment(id)}`),
  processLogs: (id: string, query?: LogTail) => api(`/processes/${segment(id)}/logs${buildQuery(query)}`),
  terminals: () => api("/terminals"),
  terminal: (id: string) => api(`/terminals/${segment(id)}`),
  builds: (query?: ProjectFilter) => api(`/builds${buildQuery(query)}`),
  build: (id: string) => api(`/builds/${segment(id)}`),
  buildLogs: (id: string, query?: LogTail) => api(`/builds/${segment(id)}/logs${buildQuery(query)}`),
  artifacts: (query?: ProjectFilter) => api(`/artifacts${buildQuery(query)}`),
  artifactDownload: (id: string, query?: TicketParam) => api(`/artifacts/${segment(id)}/download${buildQuery(query)}`),
  display: () => api("/display"),
  displayScreenshot: () => api("/display/screenshot"),
  agentRuns: (query?: ProjectFilter) => api(`/agent/runs${buildQuery(query)}`),
  agentRun: (id: string) => api(`/agent/runs/${segment(id)}`),
  events: () => api("/events"),
} as const;

export const wsPaths = {
  events: () => api("/events"),
  terminalStream: (id: string) => api(`/terminals/${segment(id)}/stream`),
  processLogStream: (id: string) => api(`/processes/${segment(id)}/logs/stream`),
  buildLogStream: (id: string) => api(`/builds/${segment(id)}/logs/stream`),
  agentRunStream: (id: string) => api(`/agent/runs/${segment(id)}/stream`),
  vnc: () => api("/display/vnc"),
} as const;

export const uiPaths = {
  terminal: (params?: TerminalPageParams) => `${UI_PREFIX}/terminal${buildFragment(params)}`,
  vnc: (params?: VncPageParams) => `${UI_PREFIX}/vnc${buildFragment(params)}`,
} as const;

/** Server-side route patterns (Hono/Express `:param` syntax), keyed like the builders above. */
export const routePatterns = {
  rest: {
    health: api("/health"),
    authTicket: api("/auth/ticket"),
    status: api("/status"),
    context: api("/context"),
    projects: api("/projects"),
    project: api("/projects/:id"),
    projectGit: api("/projects/:id/git"),
    processes: api("/processes"),
    process: api("/processes/:id"),
    processLogs: api("/processes/:id/logs"),
    terminals: api("/terminals"),
    terminal: api("/terminals/:id"),
    builds: api("/builds"),
    build: api("/builds/:id"),
    buildLogs: api("/builds/:id/logs"),
    artifacts: api("/artifacts"),
    artifactDownload: api("/artifacts/:id/download"),
    display: api("/display"),
    displayScreenshot: api("/display/screenshot"),
    agentRuns: api("/agent/runs"),
    agentRun: api("/agent/runs/:id"),
    events: api("/events"),
  },
  ws: {
    events: api("/events"),
    terminalStream: api("/terminals/:id/stream"),
    processLogStream: api("/processes/:id/logs/stream"),
    buildLogStream: api("/builds/:id/logs/stream"),
    agentRunStream: api("/agent/runs/:id/stream"),
    vnc: api("/display/vnc"),
  },
  ui: {
    terminal: `${UI_PREFIX}/terminal`,
    vnc: `${UI_PREFIX}/vnc`,
  },
} as const;
