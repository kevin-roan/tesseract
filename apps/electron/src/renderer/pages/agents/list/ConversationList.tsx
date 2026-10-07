import { AnimatePresence } from "motion/react";
import { Reveal } from "../../../components/Reveal";
import { Text } from "../../../components/Text";
import { useAttentionActions } from "../../../features/agents/hooks/use-attention-actions";
import type { ConversationListModel } from "../../../features/agents/hooks/use-conversation-list";
import { useNow } from "../../../features/agents/hooks/use-now";
import { FILTER_LABELS, LIST_LABELS } from "../../../features/agents/labels";
import { attentionForRun } from "../../../features/agents/model";
import { useAgentsUi } from "../../../features/agents/store";
import { projectBadge } from "../../../features/agents/tints";
import { Placeholder } from "../shared/Placeholder";
import { AttentionCard } from "./AttentionCard";
import { ConversationRow } from "./ConversationRow";
import { FilterChip } from "./FilterChip";
import { SearchRow } from "./SearchRow";
import { TerminalSessionRow } from "./TerminalSessionRow";
import styles from "./ConversationList.module.css";

export interface ConversationListProps {
  model: ConversationListModel;
  attention: Parameters<typeof attentionForRun>[1];
  onSelect(runId: string): void;
}

export function ConversationList({ model, attention, onSelect }: ConversationListProps) {
  const now = useNow();
  const ui = useAgentsUi();
  const actions = useAttentionActions();
  const { filter, visible, cards, terminals, names, badges, followUps, placeholder, archivedView } = model;

  return (
    <div className={styles.list}>
      <Reveal open={ui.searchOpen} className={styles.searchReveal}>
        <SearchRow value={ui.query} focusToken={ui.searchFocusToken} onChange={ui.setQuery} onStop={() => ui.setSearchOpen(false)} />
      </Reveal>
      <div className={styles.content}>
        <AnimatePresence initial={false}>
          {filter !== "all" ? <FilterChip key="chip" label={FILTER_LABELS[filter]} tooltip={LIST_LABELS.clearFilter} onClear={() => ui.setFilter("all")} /> : null}
        </AnimatePresence>
        {cards.length ? (
          <section className={styles.section} aria-label={LIST_LABELS.attention}>
            <Text variant="overline" color="text-secondary" className={styles.sectionTitle}>
              {LIST_LABELS.attention}
            </Text>
            <AnimatePresence initial={false}>
              {cards.map((item) => (
                <AttentionCard key={item.id} item={item} names={names} now={now} onOpen={actions.open} onMarkRead={(card) => void actions.markRead(card)} />
              ))}
            </AnimatePresence>
          </section>
        ) : null}
        {visible.length ? (
          <div role="listbox" aria-label={LIST_LABELS.conversations} className={styles.rows}>
            {visible.map((run) => (
              <ConversationRow
                key={run.id}
                run={run}
                names={names}
                badge={projectBadge(run.projectId, badges)}
                followUp={followUps.has(run.id)}
                unread={attentionForRun(run, attention).length > 0}
                selected={ui.view === "conversation" && ui.selectedRunId === run.id}
                archivedView={archivedView}
                now={now}
                onSelect={onSelect}
              />
            ))}
          </div>
        ) : null}
        {placeholder ? <Placeholder title={placeholder.title} loading={placeholder.loading} className={styles.placeholder} /> : null}
        {terminals.length ? (
          <section className={styles.section} aria-label={LIST_LABELS.terminals}>
            <Text variant="overline" color="text-secondary" className={styles.sectionTitle}>
              {LIST_LABELS.terminals}
            </Text>
            {terminals.map((session) => (
              <TerminalSessionRow key={session.sessionId} session={session} names={names} now={now} onOpen={actions.openTerminal} />
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}
