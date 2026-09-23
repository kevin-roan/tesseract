import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import StatusBadge from "@/components/status-badge";

import { useNewProject } from "../../hooks/use-new-project";
import { PROJECTS_ROOT } from "../../utils/constants";
import CloneProgress from "../clone-progress";
import ProjectForm from "../project-form";

const NewProjectView = () => {
  const { nav, form, clone } = useNewProject();

  if (clone) {
    return (
      <ScreenScaffold
        scroll={false}
        header={
          <ScreenHeader
            title={clone.projectId}
            subtitle={clone.gitUrl}
            onBack={nav.back}
            accessory={<StatusBadge {...clone.badge} />}
          />
        }
      >
        <CloneProgress
          lines={clone.lines}
          emptyLabel={clone.emptyLabel}
          failure={clone.failure}
          onOpenProject={clone.openProject}
        />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold
      avoidKeyboard
      header={<ScreenHeader title="New project" subtitle={`In ${PROJECTS_ROOT}`} onBack={nav.back} />}
    >
      <ProjectForm
        draft={form.draft}
        errors={form.errors}
        locationHint={form.locationHint}
        submitLabel={form.submitLabel}
        submitting={form.submitting}
        error={form.error}
        onChange={form.setField}
        onSubmit={form.submit}
      />
    </ScreenScaffold>
  );
};

export default NewProjectView;
