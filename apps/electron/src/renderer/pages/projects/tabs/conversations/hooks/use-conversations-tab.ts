import type { ClaudeSession } from "@tesseract/protocol";
import { useCallback } from "react";
import { useNavigateTo } from "../../../../../app/navigation";
import { sessionTarget } from "../model";

export function useConversationsTab(projectId: string) {
  const navigate = useNavigateTo();
  const newChat = useCallback(() => navigate("agents", { new: true, projectId }), [navigate, projectId]);
  const openSession = useCallback(
    (session: ClaudeSession) => {
      const target = sessionTarget(session);
      if (target) navigate(target.page, target.params);
    },
    [navigate],
  );
  return { newChat, openSession };
}
