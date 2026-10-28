import type { Href } from "expo-router";

export const issuesRoute = (projectId: string): Href => `/sandbox/issues?projectId=${encodeURIComponent(projectId)}` as Href;

export const issueRoute = (id: string): Href => `/sandbox/issues/${encodeURIComponent(id)}` as Href;
