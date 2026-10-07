import type { LogLine } from "@theone/protocol";
import { useCallback } from "react";
import { useNavigateTo } from "../../../../app/navigation";
import type { TabHost } from "../../../../features/projects/hooks/use-tab-host";
import { usePendingSet } from "./use-pending";

export interface FixWithAi {
  isPending(id: string): boolean;
  fix(id: string, fetchLines: () => Promise<readonly LogLine[]>, toPrompt: (lines: readonly LogLine[]) => string): void;
}

export function useFixWithAi(host: Pick<TabHost, "projectId" | "report">): FixWithAi {
  const navigate = useNavigateTo();
  const { pending, set, has } = usePendingSet();
  const { projectId, report } = host;

  const fix = useCallback<FixWithAi["fix"]>(
    (id, fetchLines, toPrompt) => {
      if (has(id)) return;
      set(id, true);
      void (async () => {
        try {
          const lines = await fetchLines();
          navigate("agents", { new: true, projectId, prompt: toPrompt(lines) });
        } catch (error) {
          report(error);
        } finally {
          set(id, false);
        }
      })();
    },
    [has, set, navigate, projectId, report],
  );

  const isPending = useCallback((id: string) => pending.has(id), [pending]);
  return { isPending, fix };
}
