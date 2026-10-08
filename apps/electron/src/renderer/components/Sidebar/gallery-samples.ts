import type { IconName } from "../../theme/icons";
import type { SidebarProjectItem, SidebarProjectsState } from "./model";

export interface NavSample {
  id: string;
  label: string;
  icon: IconName;
  count?: number;
}

export const SIDEBAR_SAMPLE = {
  width: 305,
  height: 768,
  sandboxTitle: "Sandbox",
  projectsTitle: "Projects",
  newProject: "New project",
  search: "Search conversations",
  compose: "New conversation (Ctrl+N)",
  statusTitle: "tesseract-sandbox",
  statusDetail: "Online · Live",
  statusTooltip: "Connection settings",
  pageTitle: "Overview",
  selected: "overview",
  windowWidth: 1024,
  collapsedWidth: 600,
  windowHeight: 768,
  captions: { default: "default", maximized: "maximized", backdrop: "backdrop" },
} as const;

export const NAV_SAMPLES: readonly NavSample[] = [
  { id: "overview", label: "Overview", icon: "overview" },
  { id: "agents", label: "Agents", icon: "agents" },
  { id: "projects", label: "Projects", icon: "projects" },
  { id: "files", label: "Files", icon: "files" },
  { id: "terminals", label: "Terminals", icon: "terminal" },
  { id: "display", label: "Display", icon: "display" },
];

export const NAV_COUNT_SAMPLES: Readonly<Record<string, number>> = { agents: 3 };

export const PROJECT_SAMPLES: readonly SidebarProjectItem[] = [
  { id: "streaxfit", name: "streaxfit", tint: 5, confidential: true, running: 0, runs: [] },
  { id: "tesseract", name: "tesseract", tint: 1, running: 0, runs: [] },
  { id: "hybrid-pos", name: "hybrid-pos", tint: 3, running: 0, runs: [] },
  { id: "sante-production", name: "sante-production", tint: 7, running: 0, runs: [] },
  { id: null, name: "No project", tint: null, running: 0, runs: [] },
];

export const ACTIVE_PROJECT_SAMPLES: readonly SidebarProjectItem[] = [
  {
    id: "tesseract",
    name: "tesseract",
    tint: 1,
    running: 2,
    runs: [
      { id: "run-1", title: "Port the sidebar to Electron", tone: "info", running: true, time: "2m" },
      { id: "run-2", title: "Fix the flaky e2e harness on CI", tone: "info", running: true, time: "14m" },
      { id: "run-3", title: "Bump lucide to 1.52.0", tone: "success", running: false, time: "1h" },
      { id: "run-4", title: "Investigate the emulator crash", tone: "danger", running: false, time: "3h" },
    ],
  },
  { id: "streaxfit", name: "streaxfit", tint: 5, confidential: true, running: 0, runs: [] },
  { id: "hybrid-pos", name: "hybrid-pos", tint: 3, running: 0, runs: [{ id: "run-5", title: "Untitled conversation", tone: "neutral", running: false, time: "2d" }] },
  { id: null, name: "No project", tint: null, running: 0, runs: [{ id: "run-6", title: "Explain the controller API", tone: "success", running: false, time: "5d" }] },
];

export const PROJECT_STATE_SAMPLES: readonly SidebarProjectsState[] = ["loading", "offline", "empty"];

export const PROJECTS_LABEL_SAMPLE = {
  loading: "Loading projects…",
  offline: "Connect to the sandbox to see your projects.",
  empty: "No projects yet.",
  createProject: "Create a project",
} as const;

export const EXTRA_PROJECT_SAMPLE: SidebarProjectItem = {
  id: "sante-production",
  name: "sante-production",
  tint: 7,
  running: 1,
  runs: [{ id: "run-7", title: "Deploy the staging build", tone: "info", running: true, time: "now" }],
};

export const MOTION_SAMPLE = {
  toggle: "Toggle",
  add: "Add row",
  remove: "Remove row",
  push: "Push view",
  pop: "Pop view",
  swap: "Swap",
  revealBody: "Revealed content slides down over 180 ms.",
  presenceBody: "Fades in and out over 180 / 120 ms.",
  rowPrefix: "Row",
  viewPrefix: "View",
  crossfadeA: "First label",
  crossfadeB: "Second label",
} as const;
