import type { PageSection } from "../../shared/routes";

export const SHELL_LABELS = {
  appName: "Tesseract",
  search: "Search conversations",
  compose: "New conversation (Ctrl+N)",
  projects: "Projects",
  newProject: "New project",
  noProject: "No project",
  untitledRun: "Untitled conversation",
  back: "Back",
  sections: { sandbox: "Sandbox", host: "Host", app: "App" } satisfies Record<PageSection, string>,
  projectStates: {
    loading: "Loading projects…",
    offline: "Connect to the sandbox to see your projects.",
    empty: "No projects yet.",
    createProject: "Create a project",
  },
  menu: {
    label: "Main menu",
    newConversation: "New Conversation",
    preferences: "Preferences",
    pair: "Pair a device…",
    pairHost: "Pair this computer…",
    rediscover: "Rediscover Sandbox",
    about: "About Tesseract",
    quit: "Quit",
  },
  about: {
    title: "About Tesseract",
    version: (version: string) => `Version ${version}`,
    comments: "Monitor and control the Tesseract sandbox from the host, pair phones and keep an eye on this machine.",
    close: "Close",
  },
  conversationsUnavailable: "Conversations aren't available yet",
} as const;
