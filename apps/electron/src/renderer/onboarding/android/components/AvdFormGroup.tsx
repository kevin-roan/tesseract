import { ChoiceDropdown, type ChoiceOption } from "../../../components/ChoiceDropdown";
import { useId } from "react";
import { PreferenceRow, SettingsGroup } from "../../../components/PreferenceRows";
import { TextField } from "../../../components/TextField";
import { CORES, DEVICE_PROFILES, MEMORY_MB, STORAGE_GB } from "../constants";
import type { AvdFormState } from "../hooks/use-avd-form";
import { ANDROID_LABELS } from "../labels";
import { StepperField } from "./StepperField";
import styles from "./groups.module.css";

export interface AvdFormGroupProps {
  avd: AvdFormState;
  imageOptions: readonly ChoiceOption[];
  maxCores: number;
  existingCount: number;
  emulatorError: string | null;
  disabled?: boolean;
}

const LABELS = ANDROID_LABELS.avd;

export function AvdFormGroup({ avd, imageOptions, maxCores, existingCount, emulatorError, disabled = false }: AvdFormGroupProps) {
  const { form } = avd;
  const nameId = useId();
  const noImage = imageOptions.length === 0;
  const stepper = (title: string) => ({ label: title, decreaseLabel: LABELS.decrease(title), increaseLabel: LABELS.increase(title), disabled });
  return (
    <SettingsGroup
      title={LABELS.title}
      description={existingCount > 0 ? `${LABELS.description} ${LABELS.existing(existingCount)}.` : LABELS.description}
    >
      <PreferenceRow
        title={LABELS.name}
        titleId={nameId}
        subtitle={avd.nameError ? <span className={styles.error}>{avd.nameError}</span> : LABELS.nameHint}
        suffix={
          <TextField
            aria-labelledby={nameId}
            value={form.name}
            error={avd.nameError !== null}
            onChange={avd.setName}
            disabled={disabled || noImage}
            spellCheck={false}
            size="sm"
            className={styles.entry}
          />
        }
      />
      <PreferenceRow
        title={LABELS.image}
        subtitle={
          emulatorError ? <span className={styles.error}>{ANDROID_LABELS.packages.needsEmulator(emulatorError)}</span> : noImage ? LABELS.imageNone : undefined
        }
        suffix={
          <ChoiceDropdown
            options={imageOptions}
            value={form.image}
            onChange={avd.setImage}
            ariaLabel={LABELS.image}
            disabled={disabled || imageOptions.length < 2}
            className={styles.dropdown}
          />
        }
      />
      <PreferenceRow
        title={LABELS.device}
        suffix={
          <ChoiceDropdown
            options={DEVICE_PROFILES}
            value={form.device}
            onChange={avd.setDevice}
            ariaLabel={LABELS.device}
            disabled={disabled}
            className={styles.dropdown}
          />
        }
      />
      <PreferenceRow
        title={LABELS.memory}
        suffix={<StepperField {...stepper(LABELS.memory)} value={form.ramMb} min={MEMORY_MB.min} max={MEMORY_MB.max} step={MEMORY_MB.step} unit={LABELS.units.mb} onChange={avd.setRamMb} />}
      />
      <PreferenceRow
        title={LABELS.cores}
        suffix={<StepperField {...stepper(LABELS.cores)} value={form.cores} min={CORES.min} max={maxCores} step={CORES.step} unit={LABELS.units.cores} onChange={avd.setCores} />}
      />
      <PreferenceRow
        title={LABELS.storage}
        suffix={
          <StepperField {...stepper(LABELS.storage)} value={form.storageGb} min={STORAGE_GB.min} max={STORAGE_GB.max} step={STORAGE_GB.step} unit={LABELS.units.gb} onChange={avd.setStorageGb} />
        }
      />
    </SettingsGroup>
  );
}
