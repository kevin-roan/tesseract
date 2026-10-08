import { STT_PROFILES, type SttProfile, type SttProfileInfo, type SttStatus } from "@tesseract/protocol";
import type { RadioChoice } from "../../../components/RadioRows";
import { joinMeta, pluralize } from "../shared/format";
import { SHARED_LABELS } from "../shared/labels";
import type { PropertyListItem } from "../shared/PropertyList";
import { GEMINI_SOURCE_LABELS, PROFILE_LABELS, SECTION_LABELS } from "./labels";

export function profileDetails(info: SttProfileInfo | undefined): string {
  if (!info || info.id === "off") return "";
  return joinMeta(
    info.model,
    info.threads ? pluralize(info.threads, SECTION_LABELS.thread) : null,
    info.nice ? SECTION_LABELS.nice(info.nice) : null,
  );
}

export function profileChoices(status: SttStatus | null, pending: boolean): RadioChoice<SttProfile>[] {
  const infos = new Map(status?.profiles.map((info) => [info.id, info]));
  return STT_PROFILES.map((id) => {
    const info = infos.get(id);
    const available = id === "off" || Boolean(info?.available);
    const lines = [PROFILE_LABELS[id].description, profileDetails(info), status && !available ? SECTION_LABELS.modelMissing : ""];
    return {
      id,
      title: PROFILE_LABELS[id].title,
      subtitle: lines.filter(Boolean).join("\n"),
      available: status !== null && available && !pending,
    };
  });
}

export function stateLabel(status: SttStatus): string {
  return status.ready ? SECTION_LABELS.ready : joinMeta(SECTION_LABELS.notReady, status.reason);
}

export function activityLabel(status: SttStatus): string {
  return joinMeta(status.busy ? SECTION_LABELS.busy : SECTION_LABELS.idle, status.queued ? SECTION_LABELS.queued(status.queued) : null);
}

export function statusRows(status: SttStatus): PropertyListItem[] {
  return [
    { key: SECTION_LABELS.engine, value: status.engine ?? SHARED_LABELS.none },
    { key: SECTION_LABELS.model, value: status.model ?? SHARED_LABELS.none },
    { key: SECTION_LABELS.state, value: stateLabel(status) },
    { key: SECTION_LABELS.activity, value: activityLabel(status) },
    { key: SECTION_LABELS.cpus, value: status.cpus ? String(status.cpus) : SHARED_LABELS.none },
  ];
}

export function geminiSubtitle(status: SttStatus | null): string {
  if (!status) return "";
  return joinMeta(GEMINI_SOURCE_LABELS[status.gemini.source ?? "none"], status.gemini.model || null);
}
