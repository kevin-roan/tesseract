import type { ReactNode } from "react";
import { ActionButton } from "../../../components/ActionButton";
import { ChoiceDropdown, type ChoiceOption } from "../../../components/ChoiceDropdown";
import { PROJECTS_ICONS } from "../../../features/projects/constants";
import { CLAUDE_ACCOUNT_LABELS, DETAIL_LABELS } from "../../../features/projects/labels";
import type { DisplayButtonModel } from "../../../features/projects/types";
import styles from "./ProjectDetail.module.css";

export interface DetailActionsProps {
  display: DisplayButtonModel;
  displaySlot: ReactNode;
  accountOptions: readonly ChoiceOption[] | null;
  accountValue: string;
  accountBusy: boolean;
  onAsk(): void;
  onClaudeTerminal(): void;
  onShell(): void;
  onDisplay(): void;
  onAccount(value: string): void;
}

export function DetailActions({
  display,
  displaySlot,
  accountOptions,
  accountValue,
  accountBusy,
  onAsk,
  onClaudeTerminal,
  onShell,
  onDisplay,
  onAccount,
}: DetailActionsProps) {
  return (
    <div className={styles.actions}>
      <ActionButton variant="primary" icon={PROJECTS_ICONS.agents} label={DETAIL_LABELS.askClaude} onClick={onAsk} />
      <ActionButton icon={PROJECTS_ICONS.terminal} label={DETAIL_LABELS.claudeTerminal} onClick={onClaudeTerminal} />
      <ActionButton icon={PROJECTS_ICONS.terminal} label={DETAIL_LABELS.shell} onClick={onShell} />
      {displaySlot ?? (
        <ActionButton
          icon={display.icon}
          label={display.label}
          disabled={display.disabled}
          tooltip={display.tooltip ?? undefined}
          onClick={onDisplay}
        />
      )}
      {accountOptions ? (
        <ChoiceDropdown
          options={accountOptions}
          value={accountValue}
          onChange={onAccount}
          tooltip={CLAUDE_ACCOUNT_LABELS.tooltip}
          disabled={accountBusy}
        />
      ) : null}
    </div>
  );
}
