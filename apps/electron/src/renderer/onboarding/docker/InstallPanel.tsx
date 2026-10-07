import type { DockerInstallOption } from "../../../shared/contracts/docker";
import { ActionButton } from "../../components/ActionButton";
import { Checkbox } from "../../components/Checkbox";
import { PreferenceRow, SettingsGroup } from "../../components/PreferenceRows";
import { ChoiceRow, ProgressBlock } from "../shell";
import { DOCKER_LABELS } from "./labels";
import type { InstallChoice, ProgressView } from "./model";
import styles from "./DockerStep.module.css";

export interface InstallPanelProps {
  choices: readonly InstallChoice[];
  option: DockerInstallOption;
  licenseRequired: boolean;
  accepted: boolean;
  locked: boolean;
  progress: ProgressView | null;
  onSelect(option: DockerInstallOption): void;
  onAccept(accepted: boolean): void;
  onReadLicense(): void;
}

export function InstallPanel({ choices, option, licenseRequired, accepted, locked, progress, onSelect, onAccept, onReadLicense }: InstallPanelProps) {
  return (
    <div className={styles.panel}>
      {progress ? <ProgressBlock label={progress.label} progress={progress.progress} detail={progress.detail} /> : null}
      <SettingsGroup title={DOCKER_LABELS.install.title} listRole="radiogroup">
        {choices.map((choice) => (
          <ChoiceRow
            key={choice.option}
            title={choice.title}
            subtitle={choice.subtitle ?? undefined}
            checked={choice.option === option}
            disabled={locked}
            onSelect={() => onSelect(choice.option)}
          />
        ))}
        {licenseRequired ? (
          <PreferenceRow
            title={DOCKER_LABELS.install.license}
            prefix={<Checkbox checked={accepted} disabled={locked} ariaLabel={DOCKER_LABELS.install.license} onChange={onAccept} />}
            suffix={<ActionButton variant="link" size="sm" label={DOCKER_LABELS.install.readLicense} icon="external" onClick={onReadLicense} />}
          />
        ) : null}
      </SettingsGroup>
    </div>
  );
}
