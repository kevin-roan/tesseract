import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { EmptyState } from "../../components/EmptyState";
import { useExitInert } from "../../components/Presence";
import { useContainersHost } from "../../features/containers/hooks/use-containers-host";
import { useContainersRouting } from "../../features/containers/hooks/use-containers-routing";
import { CONTAINERS_LABELS } from "../../features/containers/labels";
import { usePageHeader } from "../../shell/header-store";
import { HostUnlock } from "../shell/HostUnlock";
import { fade, pageEnter } from "../../theme/motion";
import { ContainerDetail } from "./detail/ContainerDetail";
import { CreateContainerDialog } from "./dialogs/CreateContainerDialog";
import { ContainersList } from "./list/ContainersList";
import styles from "./ContainersPage.module.css";

export default function ContainersPage() {
  const routing = useContainersRouting();
  const host = useContainersHost();
  const { name } = routing;
  const { gate } = host;
  if (gate) {
    return (
      <div className={styles.page}>
        <GateHeader />
        <EmptyState
          icon={gate.icon}
          loading={gate.loading}
          title={gate.title}
          message={gate.message}
          actionLabel={gate.actionLabel ?? undefined}
          onAction={gate.action ? host.onAction : undefined}
          secondaryLabel={gate.secondaryLabel ?? undefined}
          onSecondary={gate.secondary ? host.onSecondary : undefined}
        />
        <HostUnlock dialog={host.unlockDialog} />
      </div>
    );
  }
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

function GateHeader() {
  usePageHeader({ title: CONTAINERS_LABELS.title });
  return null;
}

function ContainersView({ detail, children }: { detail: boolean; children: ReactNode }) {
  const ref = useExitInert();
  return (
    <motion.div ref={ref} className={styles.view} variants={detail ? pageEnter : fade} initial="initial" animate="animate" exit="exit">
      {children}
    </motion.div>
  );
}
