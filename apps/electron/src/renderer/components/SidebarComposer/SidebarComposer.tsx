import { type ReactNode, type Ref, useId } from "react";
import { cx } from "../../lib/cx";
import { AttachButton, type AttachKind, SendButton, type SlashCommand, SlashHints, useComposerInput, useFileDrop } from "../Composer";
import { ACTION_SIZE, SIDEBAR_COMPOSER_SIZE } from "./constants";
import { SIDEBAR_COMPOSER_LABELS } from "./labels";
import { canSendFromSidebar, type PickerProject } from "./model";
import { ProjectPicker } from "./ProjectPicker";
import styles from "./SidebarComposer.module.css";

export interface SidebarComposerSend {
  prompt: string;
  projectId: string | null;
}

export interface SidebarComposerProps {
  value: string;
  onChange(value: string): void;
  onSend(request: SidebarComposerSend): void;
  online: boolean;
  projects: readonly PickerProject[];
  projectId: string | null;
  onProjectChange(projectId: string | null): void;
  hasAttachments?: boolean;
  attachmentsBlocked?: boolean;
  tray?: ReactNode;
  onAttach?: (kind: AttachKind) => void;
  onDropFiles?: (files: File[]) => void;
  slashCommands?: readonly SlashCommand[];
  inputRef?: Ref<HTMLTextAreaElement>;
  className?: string;
}

export function SidebarComposer({
  value,
  onChange,
  onSend,
  online,
  projects,
  projectId,
  onProjectChange,
  hasAttachments = false,
  attachmentsBlocked = false,
  tray,
  onAttach,
  onDropFiles,
  slashCommands,
  inputRef,
  className,
}: SidebarComposerProps) {
  const canSend = canSendFromSidebar({ text: value, online, hasAttachments, attachmentsBlocked });
  const send = () => {
    if (canSend) onSend({ prompt: value.trim(), projectId });
  };
  const input = useComposerInput({
    value,
    onChange,
    onSubmit: send,
    minHeight: SIDEBAR_COMPOSER_SIZE.minHeight,
    maxHeight: SIDEBAR_COMPOSER_SIZE.maxHeight,
    locked: false,
    inputRef,
    slashCommands,
  });
  const hintsId = useId();
  const drop = useFileDrop(onDropFiles);
  const tooltip = online ? SIDEBAR_COMPOSER_LABELS.send : SIDEBAR_COMPOSER_LABELS.offline;

  return (
    <div
      className={cx(styles.composer, drop.dragging && styles.dropTarget, className)}
      data-drop-target={drop.dragging || undefined}
      {...(drop.handlers ? { onDragEnter: drop.handlers.onDragEnter, onDragOver: drop.handlers.onDragOver, onDragLeave: drop.handlers.onDragLeave, onDrop: drop.handlers.onDrop } : {})}
    >
      <SlashHints
        id={hintsId}
        open={input.slash.open}
        matches={input.slash.matches}
        activeIndex={input.slash.activeIndex}
        onPick={input.acceptSlash}
      />
      {tray}
      <div className={styles.inputArea} onMouseDown={input.onAreaMouseDown}>
        <textarea
          ref={input.setTextarea}
          className={styles.input}
          value={value}
          rows={1}
          spellCheck
          aria-label={SIDEBAR_COMPOSER_LABELS.placeholder}
          aria-autocomplete={slashCommands ? "list" : undefined}
          aria-controls={input.slash.open ? hintsId : undefined}
          aria-activedescendant={input.slash.open ? `${hintsId}-${input.slash.activeIndex}` : undefined}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={input.onKeyDown}
          onPaste={drop.handlers?.onPaste}
        />
        {value === "" ? (
          <span className={styles.placeholder} aria-hidden>
            {SIDEBAR_COMPOSER_LABELS.placeholder}
          </span>
        ) : null}
      </div>
      <div className={styles.footer}>
        {onAttach ? <AttachButton onAttach={onAttach} size={ACTION_SIZE} className={styles.attach} /> : null}
        <ProjectPicker projects={projects} value={projectId} onChange={onProjectChange} />
        <span className={styles.spacer} />
        <span className={styles.send} title={tooltip}>
          <SendButton label={SIDEBAR_COMPOSER_LABELS.send} tooltip={tooltip} shape="compact" disabled={!canSend} onClick={send} />
        </span>
      </div>
    </div>
  );
}
