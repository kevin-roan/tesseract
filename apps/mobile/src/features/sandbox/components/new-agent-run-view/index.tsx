import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";

import { useNewAgentRun } from "../../hooks/use-new-agent-run";
import AgentComposer from "../agent-composer";

export type NewAgentRunViewProps = {
  projectId: string | null;
};

const NewAgentRunView = ({ projectId }: NewAgentRunViewProps) => {
  const { nav, composer, projectOptions } = useNewAgentRun(projectId);

  return (
    <ScreenScaffold
      avoidKeyboard
      header={<ScreenHeader title="Ask Claude" subtitle="Runs headless inside the sandbox" onBack={nav.back} />}
    >
      <AgentComposer
        prompt={composer.prompt}
        onChangePrompt={composer.setPrompt}
        onSubmit={composer.submit}
        canSubmit={composer.canSubmit}
        submitting={composer.isSubmitting}
        submitLabel="Start run"
        placeholder="Describe what Claude should build, fix or check…"
        error={composer.error}
        projects={projectOptions}
        projectId={composer.projectId}
        onToggleProject={composer.toggleProject}
      />
    </ScreenScaffold>
  );
};

export default NewAgentRunView;
