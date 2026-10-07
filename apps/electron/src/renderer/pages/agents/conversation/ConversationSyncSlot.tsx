import { ConversationSync } from "./ConversationSync";
import type { ConversationSyncContext } from "./types";
import { useConversationSyncSlot } from "./use-conversation-sync";

export interface ConversationSyncSlotProps {
  context: ConversationSyncContext;
  onDiscard(discard: (() => void) | null): void;
}

export function ConversationSyncSlot({ context, onDiscard }: ConversationSyncSlotProps) {
  const sync = useConversationSyncSlot(context, onDiscard);
  return <ConversationSync state={sync} compact={context.compact} />;
}
