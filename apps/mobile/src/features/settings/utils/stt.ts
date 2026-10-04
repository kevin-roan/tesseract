import { STT_PROFILES, STT_PROVIDERS, type SttProfile, type SttProvider, type SttStatus } from "@theone/protocol";

import type { ChoiceRow } from "@/components/choice-list";

import { SETTINGS_COPY, STT_PROFILE_LABELS, STT_PROVIDER_ICONS } from "./constants";

export const isSttProvider = (value: unknown): value is SttProvider =>
  (STT_PROVIDERS as readonly unknown[]).includes(value);

export const isSttProfile = (value: unknown): value is SttProfile =>
  (STT_PROFILES as readonly unknown[]).includes(value);

export function sttProviderRows(selected: SttProvider, status: SttStatus | undefined): ChoiceRow[] {
  const gemini = status?.gemini;
  return [
    {
      id: "gemini",
      label: SETTINGS_COPY.geminiLabel,
      detail: gemini ? SETTINGS_COPY.geminiDetail(gemini.model) : undefined,
      value: gemini && !gemini.configured ? SETTINGS_COPY.geminiNoKey : undefined,
      icon: STT_PROVIDER_ICONS.gemini,
      selected: selected === "gemini",
    },
    {
      id: "native",
      label: SETTINGS_COPY.nativeLabel,
      detail: SETTINGS_COPY.nativeDetail,
      icon: STT_PROVIDER_ICONS.native,
      selected: selected === "native",
    },
  ];
}

export const geminiUnavailable = (selected: SttProvider, status: SttStatus | undefined): boolean =>
  selected === "gemini" && status !== undefined && !status.gemini.configured;

export function sttProfileRows(status: SttStatus, pending: SttProfile | null): ChoiceRow[] {
  return status.profiles.map((profile) => ({
    id: profile.id,
    label: STT_PROFILE_LABELS[profile.id],
    detail: profile.model ? SETTINGS_COPY.profileDetail(profile.model, profile.threads) : SETTINGS_COPY.profileOff,
    value:
      profile.id === pending ? SETTINGS_COPY.saving : profile.available ? undefined : SETTINGS_COPY.profileMissing,
    selected: profile.id === status.profile,
    disabled: !profile.available || pending !== null,
  }));
}
