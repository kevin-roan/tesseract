import { ActionButton } from "../../../components/ActionButton";
import { PreferenceRow, PropertyRow, SettingsGroup } from "../../../components/PreferenceRows";
import { ProgressBar } from "../../../components/ProgressBar";
import { Reveal } from "../../../components/Reveal";
import { ABOUT_LABELS } from "./labels";
import type { UpdateAction, UpdateView } from "./model";
import styles from "./AboutPreferences.module.css";

export function UpdatesGroup({ view, onAction }: { view: UpdateView; onAction(action: UpdateAction): void }) {
  const U = ABOUT_LABELS.updates;
  return (
    <SettingsGroup title={U.title}>
      <PreferenceRow
        title={U.row}
        subtitle={view.subtitle}
        suffix={
          view.actionLabel ? (
            <ActionButton
              size="dialog"
              variant={view.primary ? "primary" : "secondary"}
              label={view.actionLabel}
              busy={view.busy}
              disabled={view.busy}
              onClick={() => onAction(view.action)}
            />
          ) : null
        }
      />
      {view.progress !== undefined ? (
        <div className={styles.progressRow}>
          <ProgressBar progress={view.progress} label={view.subtitle} />
        </div>
      ) : null}
      {view.notes ? (
        <Reveal open>
          <PropertyRow title={U.notes} value={view.notes} selectable />
        </Reveal>
      ) : null}
    </SettingsGroup>
  );
}
