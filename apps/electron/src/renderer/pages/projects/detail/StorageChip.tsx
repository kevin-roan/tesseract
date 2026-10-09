import type { StorageCategory } from "@tesseract/protocol";
import { useRef } from "react";
import { ActionButton } from "../../../components/ActionButton";
import { Floating, useActionMenu } from "../../../components/ActionMenu";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { PropertyChip } from "../../../components/PropertyChip";
import { Text } from "../../../components/Text";
import { PROJECTS_ICONS } from "../../../features/projects/constants";
import { useProjectStorage } from "../../../features/projects/hooks/use-project-storage";
import { STORAGE_LABELS } from "../../../features/projects/labels";
import styles from "./StorageChip.module.css";

export interface StorageChipProps {
  projectId: string;
  report(error: unknown): void;
}

export function StorageChip({ projectId, report }: StorageChipProps) {
  const storage = useProjectStorage(projectId, report);
  const menu = useActionMenu();
  const chipRef = useRef<HTMLButtonElement>(null);
  const toggle = () => {
    if (menu.open) menu.close();
    else if (chipRef.current) menu.openBelow(chipRef.current);
  };
  const clear = (categories?: readonly StorageCategory[]) => {
    menu.close();
    storage.request(categories);
  };
  return (
    <>
      <PropertyChip
        ref={chipRef}
        label={storage.label}
        icon={PROJECTS_ICONS.storage}
        tooltip={STORAGE_LABELS.title}
        expanded={menu.open}
        onClick={toggle}
      />
      <Floating
        open={menu.open && storage.total !== null}
        anchor={menu.anchor}
        onClose={menu.close}
        ignoreRef={chipRef}
        ariaLabel={STORAGE_LABELS.title}
        role="dialog"
        className={styles.panel}
        bodyClassName={styles.body}
      >
        <div className={styles.header}>
          <Text variant="overline" color="text-tertiary">
            {STORAGE_LABELS.title}
          </Text>
          <Text variant="caption" color="text-secondary">
            {STORAGE_LABELS.total} {storage.total}
          </Text>
        </div>
        <ul className={styles.rows}>
          {storage.rows.map((row) => (
            <li key={row.id} className={styles.row}>
              <Text variant="body" className={styles.label}>
                {row.label}
              </Text>
              <Text variant="caption" color="text-secondary" className={styles.size}>
                {row.size}
              </Text>
              {row.category ? (
                <ActionButton
                  size="sm"
                  variant="flat"
                  label={STORAGE_LABELS.clear}
                  disabled={!row.clearable || storage.clearing}
                  onClick={() => row.category && clear([row.category])}
                />
              ) : (
                <span className={styles.spacer} />
              )}
            </li>
          ))}
        </ul>
        <Text variant="caption" color="text-tertiary" className={styles.hint}>
          {STORAGE_LABELS.hint}
        </Text>
        <ActionButton
          block
          size="sm"
          variant="destructive"
          label={storage.clearing ? STORAGE_LABELS.clearing : STORAGE_LABELS.clearAll}
          busy={storage.clearing}
          disabled={!storage.canClearAll || storage.clearing}
          onClick={() => clear()}
        />
      </Floating>
      {storage.prompt ? (
        <ConfirmDialog
          open={storage.confirmOpen}
          heading={storage.prompt.heading}
          body={storage.prompt.body}
          confirmLabel={STORAGE_LABELS.confirm}
          cancelLabel={STORAGE_LABELS.cancel}
          onConfirm={storage.confirm}
          onClose={storage.closeConfirm}
          onExitComplete={storage.clearPending}
        />
      ) : null}
    </>
  );
}
