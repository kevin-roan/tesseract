import { useMemo } from "react";
import { router } from "expo-router";

import { issueRoute, issuesRoute } from "../utils/routes";

export function useIssueNavigation() {
  return useMemo(
    () => ({
      list: (projectId: string) => router.push(issuesRoute(projectId)),
      issue: (id: string) => router.push(issueRoute(id)),
      back: () => (router.canGoBack() ? router.back() : router.replace("/projects")),
    }),
    [],
  );
}
