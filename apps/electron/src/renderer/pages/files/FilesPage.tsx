import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { EmptyState } from "../../components/EmptyState";
import { Notice } from "../../components/Notice";
import { Crossfade } from "../../components/Presence";
import { ERROR_ICON } from "../../features/files/constants";
import { useFilesPage, type FilesPageModel } from "../../features/files/hooks/use-files-page";
import { FILES_LABELS } from "../../features/files/labels";
import { usePageHeader } from "../../shell";
import { reveal } from "../../theme/motion";
import { BuildsView } from "./BuildsView";
import { FilesDialogs } from "./FilesDialogs";
import { FilesToolbar } from "./FilesToolbar";
import { HeaderActions } from "./HeaderActions";
import { SharedFilesView } from "./SharedFilesView";
import styles from "./FilesPage.module.css";

function FilesContent({ model }: { model: FilesPageModel }) {
  const { notice } = model;
  return (
    <div className={styles.content}>
      <FilesToolbar
        view={model.view}
        tabs={model.tabs}
        onView={model.setView}
        projectFilter={model.projectFilter}
        sourceFilter={model.sourceFilter}
        outputFilter={model.outputFilter}
      />
      <AnimatePresence initial={false}>
        {notice.message ? (
          <motion.div key="notice" variants={reveal} initial="initial" animate="animate" exit="exit">
            <Notice tone="danger" message={notice.message} actionLabel={FILES_LABELS.dismiss} onAction={notice.dismiss} className={styles.notice} />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className={styles.scroll}>
        <div className={styles.body}>
          <Crossfade id={model.view}>
            {model.view === "shared" ? (
              <SharedFilesView groups={model.shared.groups} empty={model.shared.empty} actions={model.actions} />
            ) : (
              <BuildsView builds={model.builds} actions={model.actions} />
            )}
          </Crossfade>
        </div>
      </div>
    </div>
  );
}

function FilesState({ model }: { model: FilesPageModel }) {
  return (
    <div className={styles.state}>
      {model.status === "error" ? (
        <EmptyState title={FILES_LABELS.errorTitle} message={model.error} icon={ERROR_ICON} actionLabel={FILES_LABELS.retry} onAction={model.refresh} />
      ) : (
        <EmptyState title={FILES_LABELS.loading} loading icon={null} />
      )}
    </div>
  );
}

export default function FilesPage() {
  const model = useFilesPage();
  const { refresh } = model;
  usePageHeader({ actions: useMemo(() => <HeaderActions onRefresh={refresh} />, [refresh]) });
  const content = model.status === "content";
  return (
    <>
      <Crossfade id={content ? "content" : model.status} className={styles.page} layerClassName={styles.layer}>
        {content ? <FilesContent model={model} /> : <FilesState model={model} />}
      </Crossfade>
      <FilesDialogs actions={model.actions} />
    </>
  );
}
