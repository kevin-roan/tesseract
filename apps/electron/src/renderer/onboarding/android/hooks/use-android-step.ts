import { useCallback, useMemo, useState } from "react";
import type { AndroidHostSupport, InstallPlan } from "../../../../shared/contracts/android";
import type { AndroidPhase, HostInfo } from "../../../../shared/contracts/onboarding";
import type { ChoiceOption } from "../../../components/ChoiceDropdown";
import { CORES, PREFERRED_SDK_SOURCES } from "../constants";
import { useOnboardingNavigation, useOnboardingState, useReportStepStatus, type OnboardingNavigation } from "../../shell";
import {
  avdRequest,
  buildPackageRows,
  defaultImagePath,
  diskEstimate,
  emulatorTooOld,
  hasEnoughSpace,
  installedFrom,
  planPackages,
  queueItems,
  railStatus,
  sdkChoices,
  stepMode,
  totalBytes,
  type PackageRow,
  type QueueItem,
  type SdkChoice,
  type StepMode,
} from "../model";
import { useAndroidActions, type AndroidActions } from "./use-android-actions";
import { useAndroidSources, useSdkDetails, type AndroidSources, type SdkDetails } from "./use-android-sources";
import { useAvdForm, type AvdFormState } from "./use-avd-form";

export interface PackageTableState {
  tools: PackageRow[];
  images: PackageRow[];
  selected: ReadonlySet<string>;
  toggle(path: string, on: boolean): void;
  toggleAll(on: boolean): void;
}

export interface DownloadSummary {
  packages: PackageRow[];
  download: number;
  disk: number;
  freeBytes: number | null;
  enoughSpace: boolean;
  sdkRoot: string | null;
}

export interface AndroidStepModel {
  mode: StepMode;
  phase: AndroidPhase;
  host: HostInfo | null;
  support: AndroidHostSupport | null;
  sources: AndroidSources;
  details: SdkDetails;
  sdk: { choices: SdkChoice[]; value: string | null; select(path: string): void };
  table: PackageTableState;
  avd: AvdFormState;
  summary: DownloadSummary;
  emulatorError: string | null;
  imageOptions: ChoiceOption[];
  maxCores: number;
  queue: QueueItem[];
  log: string[];
  existingAvd: string | null;
  canInstall: boolean;
  actions: AndroidActions;
  navigation: OnboardingNavigation;
  startInstall(): void;
  useExisting(): void;
}

function effectivePhase(phase: AndroidPhase | null, support: AndroidHostSupport | null, catalogReady: boolean, catalogError: boolean): AndroidPhase {
  if (support && !support.supported) return { kind: "unsupported", reason: support.reason };
  const kind = phase?.kind ?? "idle";
  if (phase && kind !== "idle" && kind !== "loading-catalog" && kind !== "choosing") return phase;
  if (!catalogReady && !catalogError) return { kind: "loading-catalog" };
  return { kind: "choosing" };
}

export function useAndroidStep(): AndroidStepModel {
  const state = useOnboardingState();
  const navigation = useOnboardingNavigation();
  const actions = useAndroidActions();
  const [pickedRoot, setPickedRoot] = useState<string | null>(null);
  const [picked, setPicked] = useState<ReadonlySet<string> | null>(null);
  const [queued, setQueued] = useState<PackageRow[] | null>(null);
  const [queuedAvd, setQueuedAvd] = useState<string | null>(null);

  const host = state?.host ?? null;
  const sources = useAndroidSources(state);
  const support = sources.support;
  const defaultRoot = support?.supported ? support.defaultSdkRoot : null;
  const choices = useMemo(() => sdkChoices(sources.candidates, defaultRoot), [sources.candidates, defaultRoot]);
  const preferred = sources.candidates.find((candidate) => PREFERRED_SDK_SOURCES.includes(candidate.source))?.path ?? defaultRoot;
  const sdkRoot = pickedRoot ?? preferred ?? choices[0]?.id ?? null;
  const candidate = sources.candidates.find((item) => item.path === sdkRoot) ?? null;
  const details = useSdkDetails(support?.supported === true, sdkRoot, Boolean(candidate?.emulatorRevision));

  const catalog = sources.catalog;
  const rows = useMemo(
    () => (catalog ? buildPackageRows(catalog, installedFrom(candidate)) : { tools: [], images: [] }),
    [catalog, candidate],
  );
  const defaultSelection = useMemo(() => {
    const path = catalog ? defaultImagePath(catalog.systemImages) : null;
    return new Set(path && !rows.images.some((row) => row.path === path && row.status === "installed") ? [path] : []);
  }, [catalog, rows.images]);
  const selected = picked ?? defaultSelection;

  const toggle = useCallback(
    (path: string, on: boolean) => {
      const next = new Set(picked ?? defaultSelection);
      if (on) next.add(path);
      else next.delete(path);
      setPicked(next);
    },
    [defaultSelection, picked],
  );
  const toggleAll = useCallback(
    (on: boolean) => setPicked(new Set(on ? rows.images.filter((row) => row.status !== "installed").map((row) => row.path) : [])),
    [rows.images],
  );

  const images = catalog?.systemImages ?? [];
  const avd = useAvdForm(images, selected, details.avds, host);
  const packages = planPackages(rows, selected);
  const download = totalBytes(packages);
  const freeBytes = host?.freeDiskBytes ?? null;
  const enoughSpace = hasEnoughSpace(download, freeBytes);
  const request = sdkRoot ? avdRequest(avd.form, sdkRoot, images) : null;
  const chosenImage = images.find((image) => image.path === avd.form.image) ?? null;
  const emulatorMin = chosenImage && catalog ? emulatorTooOld(chosenImage, catalog.emulator.revision) : null;

  const imageOptions = useMemo(
    () => rows.images.filter((row) => selected.has(row.path)).map((row) => ({ id: row.path, label: row.title })),
    [rows.images, selected],
  );
  const maxCores = Math.max(CORES.preferredMax, host?.cpus ?? CORES.preferredMax);

  const phase = effectivePhase(state?.android ?? null, support, catalog !== null, sources.catalogError !== null);
  const mode = stepMode(phase);
  const warnings = phase.kind === "done" ? phase.warnings.length : 0;
  useReportStepStatus("android", railStatus(mode, warnings));

  const existingAvd = packages.length === 0 && !request && details.avds.length > 0 ? (details.avds[0]?.name ?? null) : null;
  const canInstall =
    sdkRoot !== null &&
    catalog !== null &&
    !actions.busy &&
    enoughSpace &&
    emulatorMin === null &&
    avd.nameError === null &&
    (packages.length > 0 || request !== null);

  const startInstall = useCallback(() => {
    if (!sdkRoot || !canInstall) return;
    const plan: InstallPlan = { sdkRoot, packages: packages.map((row) => row.path), avd: request };
    setQueued(packages);
    setQueuedAvd(request?.name ?? null);
    actions.install(plan);
  }, [actions, canInstall, packages, request, sdkRoot]);

  const useExisting = useCallback(() => {
    if (!sdkRoot || !existingAvd) return;
    actions.useExisting(sdkRoot, existingAvd);
  }, [actions, existingAvd, sdkRoot]);

  const queue = useMemo(
    () => queueItems(queued ?? packages, phase, queued ? queuedAvd : (request?.name ?? null)),
    [packages, phase, queued, queuedAvd, request],
  );

  return {
    mode,
    phase,
    host,
    support,
    sources,
    details,
    sdk: { choices, value: sdkRoot, select: setPickedRoot },
    table: { tools: rows.tools, images: rows.images, selected, toggle, toggleAll },
    avd,
    summary: { packages, download, disk: diskEstimate(download), freeBytes, enoughSpace, sdkRoot },
    emulatorError: emulatorMin,
    imageOptions,
    maxCores,
    queue,
    log: state?.log.android ?? [],
    existingAvd,
    canInstall,
    actions,
    navigation,
    startInstall,
    useExisting,
  };
}
