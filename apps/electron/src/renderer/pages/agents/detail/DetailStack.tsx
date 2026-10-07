import type { ReactNode } from "react";
import { Crossfade } from "../../../components/Presence";
import { DETAIL_LABELS } from "../../../features/agents/labels";
import type { DetailView } from "../../../features/agents/constants";
import { Placeholder } from "../shared/Placeholder";
import { ConversationSlot } from "./ConversationSlot";
import styles from "./DetailStack.module.css";

export interface DetailStackProps {
  view: DetailView;
  runId: string | null;
  compact: boolean;
  newView: ReactNode;
  onClose(): void;
}

export function DetailStack({ view, runId, compact, newView, onClose }: DetailStackProps) {
  const active = view === "conversation" && !runId ? "empty" : view;
  return (
    <Crossfade id={active} className={styles.stack} layerClassName={styles.layer}>
      {active === "new" ? newView : null}
      {active === "conversation" && runId ? <ConversationSlot runId={runId} compact={compact} onClose={onClose} /> : null}
      {active === "empty" ? <Placeholder title={DETAIL_LABELS.empty} icon="inbox" className={styles.fill} /> : null}
    </Crossfade>
  );
}
