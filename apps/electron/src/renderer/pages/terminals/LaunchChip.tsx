import type { Project } from "@tesseract/protocol";
import { useRef } from "react";
import { Floating, MenuItem, useActionMenu } from "../../components/ActionMenu";
import { Icon } from "../../components/Icon";
import { Text } from "../../components/Text";
import { Tooltip } from "../../components/Tooltip";
import { PICKER_NAME_MAX, PROJECT_ICON, WORKSPACE_ICON } from "../../features/terminals/constants";
import { LAUNCH_LABELS, TERMINALS_LABELS } from "../../features/terminals/labels";
import { truncateName } from "../../features/terminals/model";
import type { IconName } from "../../theme/icons";
import styles from "./LaunchChip.module.css";

export interface LaunchChipProps {
  icon: IconName;
  label: string;
  tooltip: string;
  disabled: boolean;
  projects: readonly Project[] | null;
  onLaunch(projectId: string | null): void;
}

export function LaunchChip({ icon, label, tooltip, disabled, projects, onLaunch }: LaunchChipProps) {
  const menu = useActionMenu();
  const arrowRef = useRef<HTMLButtonElement>(null);
  const pick = (projectId: string | null) => {
    menu.close();
    onLaunch(projectId);
  };
  const toggle = () => {
    const arrow = arrowRef.current;
    if (!arrow) return;
    if (menu.open) menu.close();
    else menu.openBelow(arrow);
  };
  return (
    <div className={styles.chip} data-disabled={disabled || undefined}>
      <Tooltip label={tooltip}>
        <button type="button" className={styles.main} disabled={disabled} onClick={() => onLaunch(null)}>
          <span className={styles.mainContent}>
            <Icon name={icon} size={16} />
            <span>{label}</span>
          </span>
        </button>
      </Tooltip>
      <span className={styles.separator} aria-hidden />
      <Tooltip label={LAUNCH_LABELS.pickerTooltip}>
        <button
          ref={arrowRef}
          type="button"
          className={styles.arrow}
          disabled={disabled}
          aria-label={LAUNCH_LABELS.pickerTooltip}
          aria-haspopup="menu"
          aria-expanded={menu.open}
          data-open={menu.open || undefined}
          onClick={toggle}
        >
          <span className={styles.triangle} />
        </button>
      </Tooltip>
      <Floating open={menu.open} anchor={menu.anchor} onClose={menu.close} ignoreRef={arrowRef} ariaLabel={LAUNCH_LABELS.pickerTitle} className={styles.picker} bodyClassName={styles.pickerBody}>
        <Text variant="overline" color="text-tertiary" className={styles.pickerTitle}>
          {LAUNCH_LABELS.pickerTitle}
        </Text>
        <div className={styles.pickerList}>
          <MenuItem label={TERMINALS_LABELS.workspace} icon={WORKSPACE_ICON} className={styles.pickerItem} onClick={() => pick(null)} />
          {projects === null ? (
            <Text variant="caption" color="text-secondary" className={styles.pickerLoading}>
              {LAUNCH_LABELS.loadingProjects}
            </Text>
          ) : (
            projects.map((project) => (
              <MenuItem
                key={project.id}
                label={truncateName(project.name || project.id, PICKER_NAME_MAX)}
                icon={PROJECT_ICON}
                className={styles.pickerItem}
                onClick={() => pick(project.id)}
              />
            ))
          )}
        </div>
      </Floating>
    </div>
  );
}
