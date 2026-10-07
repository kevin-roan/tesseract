import { appendLog, EMPTY_LOG_STATE } from "../components/LogView";
import { LOG_SAMPLE_LINES } from "../components/LogView/gallery-samples";
import type { RecordRowSample } from "../components/RecordRow/gallery-samples";
import { PROJECT_SAMPLES } from "../components/Sidebar/gallery-samples";
import { outcomeFor } from "../components/Timeline";

export const GALLERY_GROUPS = {
  lists: "Lists",
  richContent: "Rich content",
  appChrome: "App chrome",
} as const;

export const noop = (): void => undefined;

export const recordRowSampleKey = (sample: RecordRowSample) => sample.key;

export const NO_NAV_COUNTS: Readonly<Record<string, number>> = {};

export const COMPOSER_PROJECT_SAMPLES = PROJECT_SAMPLES.flatMap((item) => (item.id ? [{ id: item.id, name: item.name }] : []));

export const LOG_VIEW_SAMPLE_LINES = appendLog(EMPTY_LOG_STATE, LOG_SAMPLE_LINES).lines;

export const OUTCOME_SAMPLES = {
  succeeded: outcomeFor("succeeded"),
  failed: outcomeFor("failed"),
} as const;
