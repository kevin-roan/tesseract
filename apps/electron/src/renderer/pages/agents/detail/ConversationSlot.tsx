import { Suspense } from "react";
import { CONVERSATION_LABELS } from "../../../features/agents/labels";
import type { ConversationPaneProps } from "../../../features/agents/types";
import { Placeholder } from "../shared/Placeholder";
import { ConversationPane } from "./conversation-module";
import styles from "./DetailStack.module.css";

export function ConversationSlot(props: ConversationPaneProps) {
  const loading = <Placeholder title={CONVERSATION_LABELS.loading} loading className={styles.fill} />;
  if (!ConversationPane) return loading;
  return (
    <Suspense fallback={loading}>
      <ConversationPane {...props} />
    </Suspense>
  );
}
