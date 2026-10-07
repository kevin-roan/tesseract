import type { Artifact, BuildJob, ProcessInfo } from "@theone/protocol";
import { useMemo } from "react";
import type { ListKind, NoticeAction } from "../types";
import type { ProjectDetail } from "./use-project-detail";

export interface TabHostItems {
  process: ProcessInfo;
  build: BuildJob;
  artifact: Artifact;
}

export type TabHostKind = keyof TabHostItems;

export interface TabHost {
  projectId: string;
  visible: boolean;
  upsert<K extends TabHostKind>(kind: K, item: TabHostItems[K]): void;
  remove(kind: TabHostKind, id: string): void;
  report(error: unknown, action?: NoticeAction): void;
}

const LIST_OF: Record<TabHostKind, ListKind> = { process: "processes", build: "builds", artifact: "artifacts" };

export function useTabHost(projectId: string, detail: Pick<ProjectDetail, "upsert" | "remove" | "report">, visible: boolean): TabHost {
  const { upsert, remove, report } = detail;
  return useMemo<TabHost>(
    () => ({
      projectId,
      visible,
      upsert: (kind, item) => upsert(LIST_OF[kind], item as never),
      remove: (kind, id) => remove(LIST_OF[kind], id),
      report,
    }),
    [projectId, visible, upsert, remove, report],
  );
}
