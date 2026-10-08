import type { AgentRun } from "@tesseract/protocol";
import { memo } from "react";
import { AssistantMessage, OutcomeCard, outcomeFor, SystemLine, ToolCallCard, UserBubble } from "../../../components/Timeline";
import { formatRelativeTime } from "../../../features/agents/format";
import { CONVERSATION_LABELS } from "../../../features/agents/labels";
import { AgentAvatar } from "./AgentAvatar";
import { TOOL_LABELS } from "./labels";
import type { TimelineItem } from "./model";
import { outcomeMeta } from "./run-info";
import { UploadChips } from "./UploadChips";

export interface TimelineEntryProps {
  item: TimelineItem;
  run: AgentRun;
  author: boolean;
  working: boolean;
  now?: number;
}

function TimelineEntryView({ item, run, author, working, now }: TimelineEntryProps) {
  switch (item.kind) {
    case "prompt":
      return (
        <UserBubble
          text={item.text}
          author={CONVERSATION_LABELS.you}
          time={formatRelativeTime(run.startedAt, now)}
          attachments={item.attachments.length > 0 ? <UploadChips uploads={item.attachments} /> : undefined}
        />
      );
    case "text":
      return (
        <AssistantMessage
          text={item.text}
          author={author ? CONVERSATION_LABELS.claude : null}
          avatar={author ? <AgentAvatar working={working} /> : undefined}
          working={working}
          copyLabel={CONVERSATION_LABELS.copyCode}
          copiedLabel={CONVERSATION_LABELS.codeCopied}
        />
      );
    case "tool":
      return <ToolCallCard tool={item.tool} summary={item.text} result={item.result} status={item.status} labels={TOOL_LABELS} />;
    case "system":
      return <SystemLine text={item.text} />;
    case "outcome": {
      const outcome = outcomeFor(item.state);
      return (
        <OutcomeCard
          title={outcome.title}
          tone={outcome.tone}
          icon={outcome.icon}
          meta={outcomeMeta(run, now)}
          body={item.text || null}
          error={item.state === "failed" ? item.error : null}
        />
      );
    }
  }
}

export const TimelineEntry = memo(TimelineEntryView);
