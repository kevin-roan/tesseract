import { type ReactNode, type Ref, useId } from "react";
import { cx } from "../../lib/cx";
import { AttachButton } from "./AttachButton";
import { ATTACH_BUTTON_SIZE, COMPOSER_SIZE } from "./constants";
import { type AttachKind, canSubmitComposer, type SlashCommand } from "./model";
import { SendButton } from "./SendButton";
import { SlashHints } from "./SlashHints";
import { useComposerInput } from "./use-composer-input";
import { useFileDrop } from "./use-file-drop";
import styles from "./Composer.module.css";

export interface ComposerProps {
  value: string;
  onChange(value: string): void;
  onSubmit(text: string): void;
  placeholder: string;
  sendLabel: string;
  hint?: string;
  minHeight?: number;
  maxHeight?: number;
  large?: boolean;
  busy?: boolean;
  onStop?: () => void;
  stopLabel?: string;
  locked?: string | null;
  hasAttachments?: boolean;
  attachmentsBlocked?: boolean;
  tray?: ReactNode;
  properties?: ReactNode;
  accessories?: ReactNode;
  onAttach?: (kind: AttachKind) => void;
  onDropFiles?: (files: File[]) => void;
  slashCommands?: readonly SlashCommand[];
  inputRef?: Ref<HTMLTextAreaElement>;
  autoFocus?: boolean;
  className?: string;
}

export function Composer({
  value,
  onChange,
  onSubmit,
  placeholder,
  sendLabel,
  hint = "",
  large = false,
  minHeight = large ? COMPOSER_SIZE.largeMinHeight : COMPOSER_SIZE.minHeight,
  maxHeight = large ? COMPOSER_SIZE.largeMaxHeight : COMPOSER_SIZE.maxHeight,
  busy = false,
  onStop,
  stopLabel,
  locked = null,
  hasAttachments = false,
  attachmentsBlocked = false,
  tray,
  properties,
  accessories,
  onAttach,
  onDropFiles,
  slashCommands,
  inputRef,
  autoFocus,
  className,
}: ComposerProps) {
  const isLocked = locked !== null && locked !== "";
  const canSubmit = canSubmitComposer({ text: value, hasAttachments, busy, locked: isLocked, attachmentsBlocked });
  const submit = () => {
    if (canSubmit) onSubmit(value.trim());
  };
  const input = useComposerInput({ value, onChange, onSubmit: submit, minHeight, maxHeight, locked: isLocked, inputRef, slashCommands });
  const drop = useFileDrop(onDropFiles, isLocked);
  const hintsId = useId();
  const stoppable = busy && onStop !== undefined;

  return (
    <div
      className={cx(styles.composer, large && styles.large, isLocked && styles.locked, drop.dragging && styles.dropTarget, className)}
      data-drop-target={drop.dragging || undefined}
      {...(drop.handlers ? { onDragEnter: drop.handlers.onDragEnter, onDragOver: drop.handlers.onDragOver, onDragLeave: drop.handlers.onDragLeave, onDrop: drop.handlers.onDrop } : {})}
    >
      <SlashHints id={hintsId} open={input.slash.open} matches={input.slash.matches} activeIndex={input.slash.activeIndex} onPick={input.acceptSlash} />
      {tray}
      <div className={styles.inputArea} onMouseDown={input.onAreaMouseDown}>
        <textarea
          ref={input.setTextarea}
          className={styles.input}
          value={value}
          rows={1}
          readOnly={isLocked}
          autoFocus={autoFocus}
          spellCheck
          aria-label={placeholder}
          aria-autocomplete={slashCommands ? "list" : undefined}
          aria-controls={input.slash.open ? hintsId : undefined}
          aria-activedescendant={input.slash.open ? `${hintsId}-${input.slash.activeIndex}` : undefined}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={input.onKeyDown}
          onPaste={drop.handlers?.onPaste}
        />
        {value === "" ? (
          <span className={styles.placeholder} aria-hidden>
            {placeholder}
          </span>
        ) : null}
      </div>
      {properties ? <div className={styles.properties}>{properties}</div> : null}
      <div className={styles.bar}>
        <div className={styles.accessories}>
          {onAttach ? (
            <AttachButton onAttach={onAttach} size={large ? ATTACH_BUTTON_SIZE.large : ATTACH_BUTTON_SIZE.standard} disabled={isLocked} />
          ) : null}
          {accessories}
        </div>
        <span className={cx(styles.hint, isLocked && styles.hintLocked)} aria-live="polite">
          {isLocked ? locked : hint}
        </span>
        <SendButton
          label={sendLabel}
          shape={large ? "pill" : "round"}
          busy={busy}
          stopLabel={stoppable ? stopLabel ?? sendLabel : undefined}
          disabled={stoppable ? false : !canSubmit}
          onClick={stoppable ? onStop : submit}
        />
      </div>
    </div>
  );
}
