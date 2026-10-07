import { defineGalleryEntry, type GalleryEntry } from "../app/define";
import { CodeBlock } from "../components/CodeBlock";
import codeStyles from "../components/CodeBlock/CodeBlock.gallery.module.css";
import { CODE_SAMPLES } from "../components/CodeBlock/gallery-samples";
import { CopyButton } from "../components/CopyButton";
import { LogPanel, LOG_PANEL_LABELS } from "../components/LogPanel";
import { LogView } from "../components/LogView";
import { LOG_PANEL_SAMPLES } from "../components/LogView/gallery-samples";
import logStyles from "../components/LogView/LogView.gallery.module.css";
import { MarkdownView } from "../components/MarkdownView";
import { MARKDOWN_SAMPLE } from "../components/MarkdownView/gallery-samples";
import {
  AssistantMessage,
  OutcomeCard,
  SystemLine,
  ThinkingRow,
  Timeline,
  TIMELINE_LABELS,
  ToolCallCard,
  UserBubble,
} from "../components/Timeline";
import { TIMELINE_SAMPLES } from "../components/Timeline/gallery-samples";
import timelineStyles from "../components/Timeline/Timeline.gallery.module.css";
import { GALLERY_GROUPS, LOG_VIEW_SAMPLE_LINES, OUTCOME_SAMPLES } from "./gallery-samples";


export const markdownViewEntry = defineGalleryEntry({
  id: "markdown-view",
  title: "MarkdownView",
  group: GALLERY_GROUPS.richContent,
  width: 640,
  render: () => <MarkdownView text={MARKDOWN_SAMPLE} />,
});

export const codeBlockEntry = defineGalleryEntry({
  id: "code-block",
  title: "CodeBlock",
  group: GALLERY_GROUPS.richContent,
  width: 560,
  render: () => (
    <div className={codeStyles.stack}>
      {CODE_SAMPLES.map((sample) => (
        <CodeBlock key={sample.code} code={sample.code} language={sample.language} />
      ))}
    </div>
  ),
});

export const copyButtonEntry = defineGalleryEntry({
  id: "copy-button",
  title: "CopyButton",
  group: GALLERY_GROUPS.richContent,
  render: () => (
    <div className={codeStyles.row}>
      <CopyButton text={CODE_SAMPLES[0].code} />
      <CopyButton text={CODE_SAMPLES[1].code} copyLabel={TIMELINE_LABELS.copy} copiedLabel={TIMELINE_LABELS.copied} />
    </div>
  ),
});

export const logViewEntry = defineGalleryEntry({
  id: "log-view",
  title: "LogView",
  group: GALLERY_GROUPS.richContent,
  width: 720,
  render: () => (
    <div className={logStyles.stack}>
      <div className={logStyles.fixed}>
        <LogView lines={LOG_VIEW_SAMPLE_LINES} />
      </div>
      <LogView lines={[]} minHeight={LOG_PANEL_SAMPLES.endedMinHeight} />
    </div>
  ),
});

export const logPanelEntry = defineGalleryEntry({
  id: "log-panel",
  title: "LogPanel",
  group: GALLERY_GROUPS.richContent,
  width: 720,
  render: () => (
    <div className={logStyles.stack}>
      <LogPanel
        title={LOG_PANEL_SAMPLES.liveTitle}
        lines={LOG_VIEW_SAMPLE_LINES}
        status={{ label: LOG_PANEL_LABELS.status.live, tone: "success", live: true }}
        action={{ label: LOG_PANEL_SAMPLES.action, icon: "refresh" }}
        onClose={() => undefined}
        minHeight={LOG_PANEL_SAMPLES.liveMinHeight}
      />
      <LogPanel
        title={LOG_PANEL_SAMPLES.endedTitle}
        lines={[]}
        status={{ label: LOG_PANEL_LABELS.status.exited(LOG_PANEL_SAMPLES.exitCode), tone: "danger" }}
        notice={LOG_PANEL_LABELS.snapshotNotice}
        minHeight={LOG_PANEL_SAMPLES.endedMinHeight}
      />
    </div>
  ),
});

export const timelineEntry = defineGalleryEntry({
  id: "timeline",
  title: "Timeline",
  group: GALLERY_GROUPS.richContent,
  width: 760,
  render: () => (
    <div className={timelineStyles.frame}>
      <Timeline resetKey="gallery" footer={<ThinkingRow />}>
        <UserBubble key="user" text={TIMELINE_SAMPLES.user} time={TIMELINE_SAMPLES.userTime} />
        <SystemLine key="system" text={TIMELINE_SAMPLES.system} />
        {TIMELINE_SAMPLES.tools.map((tool) => (
          <ToolCallCard
            key={tool.tool}
            tool={tool.tool}
            summary={tool.summary}
            result={tool.result}
            status={tool.status}
            defaultExpanded={tool.status === "error"}
          />
        ))}
        <AssistantMessage key="assistant" author={TIMELINE_LABELS.claude} text={TIMELINE_SAMPLES.assistant} />
        <SystemLine key="run" text={TIMELINE_SAMPLES.runSystem} />
        <OutcomeCard key="done" {...OUTCOME_SAMPLES.succeeded} meta={TIMELINE_SAMPLES.outcomeMeta} />
        <OutcomeCard key="failed" {...OUTCOME_SAMPLES.failed} meta={TIMELINE_SAMPLES.failedMeta} error={TIMELINE_SAMPLES.failedError} />
      </Timeline>
    </div>
  ),
});

export const GROUP_5_ENTRIES: readonly GalleryEntry[] = [
  markdownViewEntry,
  codeBlockEntry,
  copyButtonEntry,
  logViewEntry,
  logPanelEntry,
  timelineEntry,
];
