import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useExitInert } from "../../components/Presence";
import { useProjectsRouting } from "../../features/projects/hooks/use-projects-routing";
import { fade, pageEnter } from "../../theme/motion";
import { ProjectDetail } from "./detail/ProjectDetail";
import { CreateProjectDialog } from "./dialogs/CreateProjectDialog";
import { ProjectsList } from "./list/ProjectsList";
import styles from "./ProjectsPage.module.css";

export default function ProjectsPage() {
  const routing = useProjectsRouting();
  const { projectId } = routing;
  return (
    <div className={styles.page}>
      <AnimatePresence initial={false}>
        <ProjectsView key={projectId ?? "list"} detail={Boolean(projectId)}>
          {projectId ? (
            <ProjectDetail projectId={projectId} initialTab={routing.initialTab} tabAt={routing.tabAt} onBack={routing.back} onRemoved={routing.back} />
          ) : (
            <ProjectsList onOpen={routing.openProject} onAsk={routing.askClaude} onCreate={routing.openCreate} />
          )}
        </ProjectsView>
      </AnimatePresence>
      <CreateProjectDialog open={routing.createOpen} onClose={routing.closeCreate} onCreated={(project) => routing.openProject(project.id)} />
    </div>
  );
}

function ProjectsView({ detail, children }: { detail: boolean; children: ReactNode }) {
  const ref = useExitInert();
  return (
    <motion.div ref={ref} className={styles.view} variants={detail ? pageEnter : fade} initial="initial" animate="animate" exit="exit">
      {children}
    </motion.div>
  );
}
