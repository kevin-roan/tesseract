import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useExitInert } from "../../components/Presence";
import { useContainersRouting } from "../../features/containers/hooks/use-containers-routing";
import { fade, pageEnter } from "../../theme/motion";
import { ContainerDetail } from "./detail/ContainerDetail";
import { CreateContainerDialog } from "./dialogs/CreateContainerDialog";
import { ContainersList } from "./list/ContainersList";
import styles from "./ContainersPage.module.css";

export default function ContainersPage() {
  const routing = useContainersRouting();
  const { name } = routing;
  return (
    <div className={styles.page}>
      <AnimatePresence initial={false}>
        <ContainersView key={name ?? "list"} detail={Boolean(name)}>
          {name ? (
            <ContainerDetail name={name} onBack={routing.back} onSettings={routing.openSettings} />
          ) : (
            <ContainersList onOpen={routing.openContainer} onCreate={routing.openCreate} onSettings={routing.openSettings} />
          )}
        </ContainersView>
      </AnimatePresence>
      <CreateContainerDialog open={routing.createOpen} onClose={routing.closeCreate} onCreated={(container) => routing.openContainer(container.name)} />
    </div>
  );
}

function ContainersView({ detail, children }: { detail: boolean; children: ReactNode }) {
  const ref = useExitInert();
  return (
    <motion.div ref={ref} className={styles.view} variants={detail ? pageEnter : fade} initial="initial" animate="animate" exit="exit">
      {children}
    </motion.div>
  );
}
