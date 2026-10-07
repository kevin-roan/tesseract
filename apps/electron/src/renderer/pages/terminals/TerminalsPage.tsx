import { AnimatePresence, motion } from "motion/react";
import { EmptyState } from "../../components/EmptyState";
import { useTerminalsPage } from "../../features/terminals/hooks/use-terminals-page";
import { CONNECTION_ACTION_LABELS } from "../../features/terminals/labels";
import { DRAWER_VARIANTS, SCRIM_VARIANTS } from "../../features/terminals/motion";
import { fade } from "../../theme/motion";
import { DeleteSessionDialog } from "./DeleteSessionDialog";
import { SessionsSidebar } from "./SessionsSidebar";
import { TerminalStage } from "./TerminalStage";
import { TerminalToolbar } from "./TerminalToolbar";
import styles from "./TerminalsPage.module.css";

export default function TerminalsPage() {
  const page = useTerminalsPage();
  const { layout, actions } = page;

  const sidebar = (
    <SessionsSidebar
      rows={page.rows}
      count={page.count}
      selectedId={page.selectedId}
      creating={page.creating}
      projects={page.projects}
      onSelect={actions.select}
      onDelete={actions.requestClose}
      onLaunch={(request) => void actions.launch(request)}
    />
  );

  return (
    <div ref={layout.ref} className={styles.page}>
      <AnimatePresence initial={false} mode="popLayout">
        {page.empty ? (
          <motion.div key="empty" className={styles.layer} variants={fade} initial="initial" animate="animate" exit="exit">
            <EmptyState
              title={page.empty.title}
              message={page.empty.message}
              loading={page.empty.loading}
              icon={page.empty.icon}
              actionLabel={page.empty.action ? CONNECTION_ACTION_LABELS[page.empty.action] : undefined}
              onAction={page.onEmptyAction}
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
                  onBannerAction={page.onBannerAction}
                  onNewShell={() => void actions.launch({ kind: "shell", projectId: null })}
                  onNewClaude={() => void actions.launch({ kind: "claude", projectId: null })}
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
    </div>
  );
}
