import { useState } from "react";
import { useNavigateTo } from "../../app/navigation";
import type { SidebarComposerSend } from "../../components/SidebarComposer";
import { useDraftAttachments } from "../../features/agents/hooks/use-draft-attachments";
import { useComposerProject } from "./use-composer-project";

export function useSidebarComposer() {
  const navigateTo = useNavigateTo();
  const [value, setValue] = useState("");
  const project = useComposerProject();
  const attachments = useDraftAttachments();
  const send = ({ prompt, projectId }: SidebarComposerSend) => {
    navigateTo("agents", {
      prompt,
      send: true,
      ...(projectId ? { projectId } : {}),
      ...(attachments.ids.length > 0 ? { attachmentIds: attachments.ids } : {}),
    });
    setValue("");
    attachments.clear();
  };
  return { value, setValue, projectId: project.projectId, setProjectId: project.setProjectId, attachments, send };
}
