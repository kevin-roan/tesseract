import { AnimatePresence, motion } from "motion/react";
import { useMemo, useRef } from "react";
import { EmptyState } from "../../../components/EmptyState";
import { Notice } from "../../../components/Notice";
import { OverlayScrollbar } from "../../../components/OverlayScrollbar";
import { Crossfade } from "../../../components/Presence";
import { describeError, useWindowVisible } from "../../../app/connection";
import { PROJECTS_ICONS } from "../../../features/projects/constants";
import { useDetailPage } from "../../../features/projects/hooks/use-detail-page";
import { useTabHost } from "../../../features/projects/hooks/use-tab-host";
import { DETAIL_LABELS, PROJECTS_LABELS } from "../../../features/projects/labels";
import type { ProjectTabId } from "../../../features/projects/types";
import { usePageHeader } from "../../../shell/header-store";
import { reveal } from "../../../theme/motion";
import { RemoveProjectDialog } from "../dialogs/RemoveProjectDialog";
import { RenameProjectDialog } from "../dialogs/RenameProjectDialog";
import { HeaderActions } from "../HeaderActions";
import { HostRepoActions } from "../tabs/host-repo";
import { DetailActions } from "./DetailActions";
import { DetailHeader } from "./DetailHeader";
import { DetailTabs } from "./DetailTabs";
import { TabHost } from "./TabHost";
import { EmulatorButtonSlot, useSyncCount, useSyncRefresh } from "./tab-registry";
import styles from "./ProjectDetail.module.css";

export interface ProjectDetailProps {
  projectId: string;
  initialTab: ProjectTabId | null;
  tabAt: number | null;
  onBack(): void;
  onRemoved(): void;
}

export function ProjectDetail({ projectId, initialTab, tabAt, onBack, onRemoved }: ProjectDetailProps) {
  const syncCount = useSyncCount(projectId);
  const refreshSync = useSyncRefresh();
  const page = useDetailPage({ projectId, initialTab, tabAt, syncCount, refreshSync, onRemoved });
  const { detail, project } = page;
  const visible = useWindowVisible();
  const host = useTabHost(projectId, detail, visible);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const actions = useMemo(
    () => <HeaderActions items={[{ id: "refresh", icon: PROJECTS_ICONS.refresh, label: DETAIL_LABELS.refresh, onClick: page.refresh }]} />,
    [page.refresh],
  );
  usePageHeader({ parent: PROJECTS_LABELS.title, title: page.title, actions, onBack });

  const loadError = detail.state.loadError;
  const stateKey = project ? "content" : loadError ? "error" : "loading";

  return (
    <Crossfade id={stateKey} className={styles.root}>
      {!project ? (
        <div className={styles.fill}>
          {loadError ? (
            <EmptyState
              icon={PROJECTS_ICONS.warning}
              title={DETAIL_LABELS.loadFailed}
              message={describeError(loadError)}
              actionLabel={DETAIL_LABELS.tryAgain}
              onAction={page.refresh}
            />
          ) : (
            <EmptyState loading title={DETAIL_LABELS.loading} />
          )}
        </div>
      ) : (
        <div className={styles.frame}>
          <div ref={scrollerRef} className={styles.scroller}>
            <div className={styles.body}>
              <DetailHeader
                project={project}
                title={page.title}
                chips={page.chips}
                removing={page.removal.checking}
                onCopyPath={page.copyPath}
                onRename={page.openRename}
                onDelete={page.removal.start}
                onError={detail.report}
              />
              <DetailActions
                display={page.display}
                displaySlot={
                  EmulatorButtonSlot ? (
                    <EmulatorButtonSlot
                      projectId={project.id}
                      projectName={page.title}
                      framework={project.framework}
                      runTargets={detail.state.runTargets}
                      appRuns={detail.state.appRuns}
                      runTargetsError={detail.state.runTargetsError}
                      report={detail.report}
                      onRun={detail.upsertAppRun}
                    />
                  ) : null
                }
                hostSlot={<HostRepoActions projectId={project.id} projectName={page.title} report={detail.report} />}
                accountOptions={page.accountOptions}
                accountValue={page.accountValue}
                accountBusy={page.account.busy}
                onAsk={page.actions.ask}
                onClaudeTerminal={page.actions.claudeTerminal}
                onShell={page.actions.shell}
                onDisplay={page.runDisplay}
                onAccount={page.account.change}
              />
              <AnimatePresence initial={false}>
                {detail.notice ? (
                  <motion.div key="notice" variants={reveal} initial="initial" animate="animate" exit="exit">
                    <Notice
                      className={styles.notice}
                      tone="danger"
                      message={detail.notice.message}
                      actionLabel={detail.notice.action?.label ?? DETAIL_LABELS.dismiss}
                      onAction={() => {
                        const action = detail.notice?.action;
                        detail.dismissNotice();
                        action?.run();
                      }}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>
              <DetailTabs tabs={page.tabs} selected={page.tab} onChange={page.setTab} />
              <TabHost tab={page.tab} project={project} state={detail.state} runs={detail.runs} host={host} />
            </div>
            <RenameProjectDialog open={page.renameOpen} project={project} onRenamed={detail.setProject} onClose={page.closeRename} />
            <RemoveProjectDialog
              prompt={page.removal.prompt}
              open={page.removal.open}
              onConfirm={() => void page.removal.confirm()}
              onClose={page.removal.cancel}
            />
          </div>
          <OverlayScrollbar target={scrollerRef} />
        </div>
      )}
    </Crossfade>
  );
}
