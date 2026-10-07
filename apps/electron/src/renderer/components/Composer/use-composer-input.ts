import { type KeyboardEvent, type MouseEvent, type Ref, type RefObject, useCallback, useRef } from "react";
import { isSubmitKey, type SlashCommand } from "./model";
import { assignRef } from "./refs";
import { useAutoGrow } from "./use-auto-grow";
import { type SlashHints, useSlashHints } from "./use-slash-hints";

export interface ComposerInputOptions {
  value: string;
  onChange(value: string): void;
  onSubmit(): void;
  minHeight: number;
  maxHeight: number;
  locked: boolean;
  inputRef?: Ref<HTMLTextAreaElement>;
  slashCommands?: readonly SlashCommand[];
}

export interface ComposerInput {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  setTextarea(node: HTMLTextAreaElement | null): void;
  slash: SlashHints;
  onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void;
  onAreaMouseDown(event: MouseEvent<HTMLElement>): void;
  acceptSlash(index: number): void;
}

export function useComposerInput({
  value,
  onChange,
  onSubmit,
  minHeight,
  maxHeight,
  locked,
  inputRef,
  slashCommands,
}: ComposerInputOptions): ComposerInput {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const slash = useSlashHints(value, locked ? undefined : slashCommands);
  useAutoGrow(textareaRef, value, minHeight, maxHeight);

  const setTextarea = useCallback(
    (node: HTMLTextAreaElement | null) => {
      textareaRef.current = node;
      assignRef(inputRef, node);
    },
    [inputRef],
  );

  const acceptSlash = (index: number) => {
    const completed = slash.accept(index);
    if (completed === null) return;
    onChange(completed);
    textareaRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const native = event.nativeEvent;
    if (slash.open && !native.isComposing) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        slash.move(event.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
        event.preventDefault();
        acceptSlash(slash.activeIndex);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        slash.dismiss();
        return;
      }
    }
    if (isSubmitKey({ key: event.key, shiftKey: event.shiftKey, isComposing: native.isComposing, keyCode: native.keyCode })) {
      event.preventDefault();
      onSubmit();
    }
  };

  const onAreaMouseDown = (event: MouseEvent<HTMLElement>) => {
    const textarea = textareaRef.current;
    if (!textarea || locked || event.target === textarea) return;
    event.preventDefault();
    textarea.focus();
  };

  return { textareaRef, setTextarea, slash, onKeyDown, onAreaMouseDown, acceptSlash };
}
