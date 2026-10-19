import type { Project } from "@tesseract/protocol";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { EmptyState } from "../../components/EmptyState";
import type { LauncherConfig } from "../../features/terminals/constants";
import type { TerminalsWorkspace } from "../../features/terminals/hooks/use-terminals-workspace";
import { DRAWER_VARIANTS, SCRIM_VARIANTS } from "../../features/terminals/motion";
import type { PlaceholderModel, TerminalsEmptyModel } from "../../features/terminals/types";
import { fade } from "../../theme/motion";
import { DeleteSessionDialog } from "./DeleteSessionDialog";
import { SessionsSidebar } from "./SessionsSidebar";
import { TerminalStage } from "./TerminalStage";
import { TerminalToolbar } from "./TerminalToolbar";
import styles from "./TerminalsPage.module.css";

export interface TerminalsLayoutProps {
  page: TerminalsWorkspace;
  empty: TerminalsEmptyModel | null;
  onEmptyAction?: (() => void) | null;
  onEmptySecondary?: (() => void) | null;
  launchers: readonly LauncherConfig[];
  placeholder: PlaceholderModel;
  projects?: readonly Project[] | null;
  children?: ReactNode;
}

export function TerminalsLayout({ page, empty, onEmptyAction, onEmptySecondary, launchers, placeholder, projects, children }: TerminalsLayoutProps) {
  const { layout, actions } = page;
  const launch = (kind: PlaceholderModel["primaryKind"] | null) => {
    if (kind) void actions.launch({ kind, projectId: null });
  };

  const sidebar = (
    <SessionsSidebar
      rows={page.rows}
      count={page.count}
      selectedId={page.selectedId}
      creating={page.creating}
      launchers={launchers}
      projects={projects}
      onSelect={actions.select}
      onDelete={actions.requestClose}
      onLaunch={(request) => void actions.launch(request)}
    />
  );

  return (
    <div ref={layout.ref} className={styles.page}>
      <AnimatePresence initial={false} mode="popLayout">
        {empty ? (
          <motion.div key="empty" className={styles.layer} variants={fade} initial="initial" animate="animate" exit="exit">
            <EmptyState
              title={empty.title}
              message={empty.message}
              loading={empty.loading}
              icon={empty.icon}
              actionLabel={empty.actionLabel ?? undefined}
              onAction={onEmptyAction ?? undefined}
              secondaryLabel={empty.secondaryLabel ?? undefined}
              onSecondary={onEmptySecondary ?? undefined}
            />
          </motion.div>
        ) : (
          <motion.div key="main" className={styles.layer} variants={fade} initial="initial" animate="animate" exit="exit">
            <div className={styles.split} style={layout.measured ? undefined : { visibility: "hidden" }}>
              {layout.collapsed ? null : (
                <aside className={styles.sidebar} style={{ width: layout.sidebarWidth }}>
                  {sidebar}
                </aside>
              )}
              <section className={styles.content}>
                {page.toolbarVisible ? (
                  <TerminalToolbar
                    collapsed={layout.collapsed}
                    session={page.toolbarSession}
                    menu={page.menus.toolbar}
                    onToggleSidebar={layout.openDrawer}
                    onRestart={() => page.selectedId && actions.restart(page.selectedId)}
                    onClose={() => page.selectedId && actions.requestClose(page.selectedId)}
                  />
                ) : null}
                <TerminalStage
                  stageRef={page.stageRef}
                  attached={page.attached}
                  selectedId={page.selectedId}
                  background={page.background}
                  banner={page.banner}
                  creating={page.creating}
                  contextMenu={page.menus.context}
                  placeholder={placeholder}
                  onBannerAction={page.onBannerAction}
                  onPrimary={() => launch(placeholder.primaryKind)}
                  onSecondary={() => launch(placeholder.secondaryKind)}
                />
              </section>
              <AnimatePresence>
                {layout.drawerOpen ? (
                  <>
                    <motion.div key="scrim" className={styles.scrim} variants={SCRIM_VARIANTS} initial="hidden" animate="shown" exit="hidden" onClick={layout.closeDrawer} />
                    <motion.aside key="drawer" className={styles.drawer} style={{ width: layout.sidebarWidth }} variants={DRAWER_VARIANTS} initial="hidden" animate="shown" exit="hidden">
                      {sidebar}
                    </motion.aside>
                  </>
                ) : null}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <DeleteSessionDialog target={page.confirm} onConfirm={(id) => void actions.remove(id)} onClose={page.cancelConfirm} />
      {children}
    </div>
  );
}
