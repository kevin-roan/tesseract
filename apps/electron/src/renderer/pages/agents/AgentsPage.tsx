import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { cx } from "../../lib/cx";
import { usePageHeader } from "../../shell";
import { useAgentEvents } from "../../features/agents/hooks/use-agent-events";
import { useAgentAttachments } from "../../features/agents/hooks/use-attachments";
import { useAgentsParams } from "../../features/agents/hooks/use-agents-params";
import { useConversationList } from "../../features/agents/hooks/use-conversation-list";
import { useSplitLayout } from "../../features/agents/hooks/use-split-layout";
import { useStartRun } from "../../features/agents/hooks/use-start-run";
import { useAgentDetails } from "../../features/agents/hooks/use-agent-details";
import { projectOptions } from "../../features/agents/model";
import { useAgentsUi } from "../../features/agents/store";
import { DeleteConfirmHost } from "./DeleteConfirmHost";
import { DetailStack } from "./detail/DetailStack";
import { NewConversationView } from "./detail/NewConversationView";
import { HeaderActions } from "./HeaderActions";
import { ConversationList } from "./list/ConversationList";
import { DRAWER_VARIANTS, paneTransition, SCRIM_VARIANTS } from "./motion";
import styles from "./AgentsPage.module.css";

export default function AgentsPage() {
  const ui = useAgentsUi();
  const layout = useSplitLayout();
  const { collapsed, compact, width, sidebarOpen } = layout;
  const model = useConversationList();
  const details = useAgentDetails();
  const runner = useStartRun();
  const attachments = useAgentAttachments();

  useAgentEvents();
  useAgentsParams(runner.start, runner.ready);
  usePageHeader({ actions: useMemo(() => <HeaderActions />, []) });

  const submit = async (text: string) => {
    const run = await runner.start({ prompt: attachments.prompt(text), projectId: ui.draft.projectId, attachmentIds: attachments.uploadIds });
    if (run) attachments.clear();
  };

  const list = <ConversationList model={model} attention={details.attention} onSelect={ui.select} />;
  const newView = (
    <NewConversationView
      draft={ui.draft}
      options={projectOptions(model.projects)}
      attachments={attachments}
      busy={runner.busy}
      error={runner.error}
      focusToken={ui.focusToken}
      onDraft={ui.setDraft}
      onSubmit={(prompt) => void submit(prompt)}
      onClose={ui.closeDetail}
    />
  );

  return (
    <div ref={layout.ref} className={styles.page} data-collapsed={collapsed || undefined} data-compact={compact || undefined}>
      {collapsed ? null : (
        <motion.aside
          className={cx(styles.listPane, !layout.measured && styles.unmeasured)}
          initial={false}
          animate={layout.measured ? (sidebarOpen ? { width, opacity: 1 } : { width: 0, opacity: 0 }) : undefined}
          transition={paneTransition(layout.animateToggle)}
          aria-hidden={!sidebarOpen || undefined}
          inert={!sidebarOpen || undefined}
        >
          <div className={styles.listInner} style={layout.measured ? { width } : undefined}>
            {list}
          </div>
        </motion.aside>
      )}
      <div className={styles.detail}>
        <DetailStack view={ui.view} runId={ui.selectedRunId} compact={compact} newView={newView} onClose={ui.closeDetail} />
      </div>
      <AnimatePresence>
        {collapsed && sidebarOpen ? (
          <>
            <motion.div key="scrim" className={styles.scrim} variants={SCRIM_VARIANTS} initial="hidden" animate="shown" exit="hidden" onClick={() => ui.setSidebarOpen(false)} />
            <motion.aside key="drawer" className={styles.drawer} style={{ width }} variants={DRAWER_VARIANTS} initial="hidden" animate="shown" exit="hidden">
              {list}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
      <DeleteConfirmHost />
    </div>
  );
}
