import type { SandboxStatus } from "@tesseract/protocol";
import { sandboxName, seriesPoints, seriesStats, type ConnectionState, type InboxCounts, type MetricsSample } from "../../app/connection";
import type { KeyValueEntry } from "../../components/KeyValueList";
import type { ChartSeries, ChartThreshold } from "../../components/TimeSeriesChart";
import type { LegendItem } from "../../components/SeriesLegend";
import type { StatItem } from "../../components/StatCard";
import type { SurfaceTone } from "../../components/Surface";
import type { Tone } from "../../theme/colors";
import type { IconName } from "../../theme/icons";
import {
  COUNT_ICONS,
  COUNT_KEYS,
  COUNT_TARGETS,
  DEFAULT_RANGE,
  EMPTY_ACTIONS,
  EMPTY_ICONS,
  HISTORY_RANGE_S,
  HISTORY_RANGES,
  LOAD_WARNING,
  LOADING_STATUSES,
  RESOURCE_GRID,
  RESOURCE_ICONS,
  SERIES_SPECS,
  type CountKey,
  type CountTarget,
  type EmptyAction,
  type HistoryRange,
  type SeriesId,
} from "./constants";
import { formatBytes, formatLoad, formatRelativeTime, formatUptime, joinMeta, percentLabel, pluralize, ratio, splitBytes } from "./format";
import {
  ATTENTION_LABELS,
  DISPLAY_LABELS,
  EMPTY_LABELS,
  HISTORY_LABELS,
  META_LABELS,
  OVERVIEW_LABELS,
  RANGE_LABELS,
  RESOURCE_LABELS,
  COUNT_LABELS,
  SERIES_LABELS,
} from "./labels";

export interface ActivityItem {
  id: CountKey;
  icon: IconName;
  label: string;
  value: string;
  target: CountTarget;
}

export interface EmptyButton {
  label: string;
  action: EmptyAction;
}

export interface EmptyModel {
  title: string;
  message: string;
  icon: IconName | null;
  loading: boolean;
  primary: EmptyButton | null;
  secondary: EmptyButton | null;
}

export interface AttentionNotice {
  title: string;
  message: string;
  tone: Tone;
  actionLabel: string;
}

export interface SeriesSummary {
  value: string | null;
  caption: string;
}

export interface RangeOption {
  id: HistoryRange;
  label: string;
}

type StatusState = Pick<ConnectionState, "status" | "errorMessage" | "health" | "config">;

export function overviewTitle(status: SandboxStatus | null, state: Pick<ConnectionState, "health" | "config">): string {
  return status?.sandboxId || sandboxName(state) || OVERVIEW_LABELS.fallbackTitle;
}

export function overviewMeta(status: SandboxStatus | null): string | null {
  if (!status) return null;
  return joinMeta(META_LABELS.uptime(formatUptime(status.uptimeSec)), status.hostname, META_LABELS.version(status.version));
}

export function loadFraction(status: SandboxStatus): number {
  const { cpu } = status.resources;
  return ratio(cpu.load1, Math.max(1, cpu.cores)) ?? 0;
}

export function usageTone(fraction: number | null): SurfaceTone {
  return (fraction ?? 0) >= LOAD_WARNING ? "violet" : "neutral";
}

export function resourceItems(status: SandboxStatus, now: number = Date.now() / 1000): StatItem[] {
  const { cpu, memory, disk } = status.resources;
  const load = loadFraction(status);
  const memoryUsed = splitBytes(memory.usedBytes);
  const memoryRatio = ratio(memory.usedBytes, memory.totalBytes);
  const diskUsed = splitBytes(disk.usedBytes);
  const diskRatio = ratio(disk.usedBytes, disk.totalBytes);
  return [
    {
      id: "cpu",
      icon: RESOURCE_ICONS.cpu,
      label: RESOURCE_LABELS.cpu,
      value: formatLoad(cpu.load1),
      unit: RESOURCE_LABELS.cpuUnit,
      progress: load,
      tone: usageTone(load),
      caption: RESOURCE_LABELS.cpuCaption(cpu.cores, formatLoad(cpu.load5), formatLoad(cpu.load15)),
    },
    {
      id: "memory",
      icon: RESOURCE_ICONS.memory,
      label: RESOURCE_LABELS.memory,
      value: memoryUsed.value,
      unit: memoryUsed.unit,
      progress: memoryRatio,
      tone: usageTone(memoryRatio),
      caption: RESOURCE_LABELS.memoryCaption(formatBytes(memory.totalBytes)),
    },
    {
      id: "disk",
      icon: RESOURCE_ICONS.disk,
      label: RESOURCE_LABELS.disk,
      value: diskUsed.value,
      unit: diskUsed.unit,
      progress: diskRatio,
      tone: usageTone(diskRatio),
      caption: RESOURCE_LABELS.diskCaption(formatBytes(disk.totalBytes), disk.path),
    },
    {
      id: "uptime",
      icon: RESOURCE_ICONS.uptime,
      label: RESOURCE_LABELS.uptime,
      value: formatUptime(status.uptimeSec),
      caption: RESOURCE_LABELS.uptimeCaption(formatRelativeTime(status.startedAt, now)),
    },
  ];
}

export function countItems(status: SandboxStatus): ActivityItem[] {
  const counts: Partial<SandboxStatus["counts"]> = status.counts ?? {};
  return COUNT_KEYS.map((key) => ({
    id: key,
    icon: COUNT_ICONS[key],
    label: COUNT_LABELS[key],
    value: String(counts[key] ?? 0),
    target: COUNT_TARGETS[key],
  }));
}

const availability = (available: boolean) => (available ? DISPLAY_LABELS.available : DISPLAY_LABELS.unavailable);

export function displayRows(status: SandboxStatus): KeyValueEntry[] {
  const { display } = status;
  const resolution = display.width && display.height ? DISPLAY_LABELS.resolutionValue(display.width, display.height) : DISPLAY_LABELS.unknown;
  return [
    [DISPLAY_LABELS.display, DISPLAY_LABELS.displayValue(display.display, availability(display.available))],
    [DISPLAY_LABELS.resolution, resolution],
    [DISPLAY_LABELS.vnc, DISPLAY_LABELS.vncValue(display.vnc.port, availability(display.vnc.available))],
  ];
}

export function toolRows(status: SandboxStatus): KeyValueEntry[] {
  return (status.tools ?? []).map((tool) => [tool.name, tool.version || DISPLAY_LABELS.missing] as const);
}

function emptyButton(label: string | null, action: EmptyAction | null | undefined): EmptyButton | null {
  return label && action ? { label, action } : null;
}

export function emptyModel(state: StatusState): EmptyModel {
  const status = state.status === "online" ? "connecting" : state.status;
  const template = EMPTY_LABELS[status];
  const [primary, secondary] = EMPTY_ACTIONS[status] ?? [null, null];
  const message = typeof template.message === "function" ? template.message(state.errorMessage ?? "") : template.message;
  return {
    title: template.title,
    message,
    icon: EMPTY_ICONS[status] ?? null,
    loading: LOADING_STATUSES.includes(status),
    primary: emptyButton(template.primary, primary),
    secondary: emptyButton(template.secondary, secondary),
  };
}

export function attentionNotice(inbox: InboxCounts): AttentionNotice | null {
  const count = inbox.attentionCount ?? 0;
  if (!(count > 0)) return null;
  return {
    title: ATTENTION_LABELS.title,
    message: ATTENTION_LABELS.message(pluralize(count, ATTENTION_LABELS.session)),
    tone: "warning",
    actionLabel: ATTENTION_LABELS.action,
  };
}

export function rangeSeconds(range: HistoryRange): number {
  return HISTORY_RANGE_S[range] ?? HISTORY_RANGE_S[DEFAULT_RANGE];
}

export function rangeOptions(): RangeOption[] {
  return HISTORY_RANGES.map((id) => ({ id, label: RANGE_LABELS[id] }));
}

export function defaultHidden(): SeriesId[] {
  return SERIES_SPECS.filter((spec) => !spec.visible).map((spec) => spec.key);
}

export function chartSeries(samples: readonly MetricsSample[]): ChartSeries[] {
  return SERIES_SPECS.map((spec) => ({
    key: spec.key,
    label: SERIES_LABELS[spec.key],
    color: spec.color,
    points: seriesPoints(samples, spec.key),
    fill: spec.fill,
    dash: spec.dash,
  }));
}

export function loadThreshold(): ChartThreshold {
  return { value: LOAD_WARNING, label: HISTORY_LABELS.threshold(percentLabel(LOAD_WARNING)) };
}

export function seriesSummaries(samples: readonly MetricsSample[], start: number): Record<SeriesId, SeriesSummary> {
  const entries = SERIES_SPECS.map((spec) => {
    const stats = seriesStats(samples, spec.key, start);
    if (stats.current === null || stats.average === null || stats.peak === null) {
      return [spec.key, { value: null, caption: HISTORY_LABELS.statsEmpty }] as const;
    }
    return [spec.key, { value: percentLabel(stats.current), caption: HISTORY_LABELS.stats(percentLabel(stats.average), percentLabel(stats.peak)) }] as const;
  });
  return Object.fromEntries(entries) as Record<SeriesId, SeriesSummary>;
}

export function legendItems(summaries: Partial<Record<SeriesId, SeriesSummary>>): LegendItem[] {
  return SERIES_SPECS.map((spec) => ({
    key: spec.key,
    label: SERIES_LABELS[spec.key],
    color: spec.color,
    dash: spec.dash,
    value: summaries[spec.key]?.value ?? null,
    caption: summaries[spec.key]?.caption ?? HISTORY_LABELS.statsEmpty,
  }));
}

export function resourceColumns(width: number): number {
  const { wide, narrow, minTile, gap } = RESOURCE_GRID;
  return width > 0 && width >= wide * minTile + (wide - 1) * gap ? wide : narrow;
}
