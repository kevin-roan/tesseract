import ProjectClaudeAccount from "@/features/claude-account/components/project-claude-account";
import { useProjectClaudeAccount } from "@/features/claude-account/hooks/use-project-claude-account";
import { SandboxScope } from "@/features/sandbox/hooks/sandbox-scope";
import { useProject } from "@/features/sandbox/hooks/use-sandbox-queries";

import { HOST_PROJECT_COPY as COPY } from "../../utils/content";

export type HostProjectAccountProps = {
  workspaceId: string;
  projectId: string;
};

/** The Claude account the project's copy on the host runs with, read and changed on the host workspace controller. */
const HostProjectAccount = ({ workspaceId, projectId }: HostProjectAccountProps) => (
  <SandboxScope id={workspaceId}>
    <ScopedAccount projectId={projectId} />
  </SandboxScope>
);

const ScopedAccount = ({ projectId }: { projectId: string }) => {
  const project = useProject(projectId);
  const state = useProjectClaudeAccount(project.data);
  return state.visible ? <ProjectClaudeAccount state={state} title={COPY.accountTitle} testID="host-project-account" /> : null;
};

export default HostProjectAccount;
