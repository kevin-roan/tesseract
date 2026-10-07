import { useMemo } from "react";
import { useAgentAttachments } from "./use-attachments";

export function useDraftAttachments() {
  const attachments = useAgentAttachments();
  return useMemo(() => ({ ...attachments, items: attachments.drafts, ids: attachments.uploadIds }), [attachments]);
}
