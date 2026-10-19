import type { ReactNode } from "react";
import { Text } from "../Text";
import { LinkField } from "./LinkField";
import type { PairStep } from "./model";
import styles from "./PairDialog.module.css";

export interface SetupStepsProps {
  steps: PairStep[];
  label: string;
  copyLabel: string;
  onCopy(command: string): void;
  input?: ReactNode;
}

export function SetupSteps({ steps, label, copyLabel, onCopy, input }: SetupStepsProps) {
  return (
    <ol className={styles.steps} aria-label={label}>
      {steps.map((step, index) => (
        <li key={step.id} className={styles.step}>
          <span className={styles.stepNumber} aria-hidden="true">
            {index + 1}
          </span>
          <div className={styles.stepBody}>
            <Text variant="body" color="text-secondary" wrap lines={null}>
              {step.text}
            </Text>
            {step.command ? <LinkField value={step.command} copyLabel={copyLabel} onCopy={onCopy} testId="pair-command" /> : null}
            {step.input ? input : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
