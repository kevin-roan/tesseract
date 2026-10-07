import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import type { InstallPlan } from "../../../../../shared/contracts/android";
import { ipc } from "../../../../lib/ipc";
import { ACCEL_DOCS_URL, CORES, PREFERRED_SDK_SOURCES, QUERY_KEYS } from "../../../../onboarding/android/constants";
import { useSdkDetails } from "../../../../onboarding/android/hooks/use-android-sources";
import type { DownloadSummary } from "../../../../onboarding/android/hooks/use-android-step";
import { useAvdForm } from "../../../../onboarding/android/hooks/use-avd-form";
import {
  avdRequest,
  buildPackageRows,
  defaultImagePath,
  diskEstimate,
  emulatorTooOld,
  installedFrom,
  planPackages,
  queueItems,
  sdkChoices,
  totalBytes,
  type PackageRow,
} from "../../../../onboarding/android/model";
import { installingPhase, licensesFor } from "../model";
import { useAndroidSources } from "./use-android-sources";
import { useInstallFlow } from "./use-install-flow";

function hardwareThreads(): number {
  return globalThis.navigator?.hardwareConcurrency ?? CORES.preferredMax;
}

export function useAndroidSettings() {
  const client = useQueryClient();
  const sources = useAndroidSources();
  const [pickedRoot, setPickedRoot] = useState<string | null>(null);
  const [picked, setPicked] = useState<ReadonlySet<string> | null>(null);
  const [createDevice, setCreateDevice] = useState<boolean | null>(null);
  const [queued, setQueued] = useState<{ packages: PackageRow[]; avd: string | null } | null>(null);

  const support = sources.support;
  const supported = support?.supported === true;
  const defaultRoot = support?.supported ? support.defaultSdkRoot : null;
  const choices = useMemo(() => sdkChoices(sources.candidates, defaultRoot), [sources.candidates, defaultRoot]);
  const preferred = sources.candidates.find((candidate) => PREFERRED_SDK_SOURCES.includes(candidate.source))?.path ?? sources.candidates[0]?.path ?? defaultRoot;
  const sdkRoot = pickedRoot ?? preferred ?? choices[0]?.id ?? null;
  const candidate = sources.candidates.find((item) => item.path === sdkRoot) ?? null;
  const details = useSdkDetails(supported, sdkRoot, Boolean(candidate?.emulatorRevision));

  const catalog = sources.catalog;
  const rows = useMemo(() => (catalog ? buildPackageRows(catalog, installedFrom(candidate)) : { tools: [], images: [] }), [catalog, candidate]);
  const defaultSelection = useMemo(() => {
    const path = catalog && details.avds.length === 0 ? defaultImagePath(catalog.systemImages) : null;
    return new Set(path ? [path] : []);
  }, [catalog, details.avds.length]);
  const selected = picked ?? defaultSelection;

  const toggle = useCallback(
    (path: string, on: boolean) => {
      const next = new Set(selected);
      if (on) next.add(path);
      else next.delete(path);
      setPicked(next);
    },
    [selected],
  );
  const toggleAll = useCallback(
    (on: boolean) => setPicked(new Set(on ? rows.images.filter((row) => row.status !== "installed").map((row) => row.path) : [])),
    [rows.images],
  );

  const images = catalog?.systemImages ?? [];
  const avd = useAvdForm(images, selected, details.avds, null);
  const wantsDevice = (createDevice ?? details.avds.length === 0) && selected.size > 0;
  const request = sdkRoot && wantsDevice ? avdRequest(avd.form, sdkRoot, images) : null;
  const packages = planPackages(rows, selected);
  const download = totalBytes(packages);
  const chosenImage = images.find((image) => image.path === avd.form.image) ?? null;
  const emulatorError = chosenImage && catalog ? emulatorTooOld(chosenImage, catalog.emulator.revision) : null;
  const imageOptions = useMemo(
    () => rows.images.filter((row) => selected.has(row.path)).map((row) => ({ id: row.path, label: row.title })),
    [rows.images, selected],
  );
  const summary: DownloadSummary = { packages, download, disk: diskEstimate(download), freeBytes: null, enoughSpace: true, sdkRoot };

  const finished = useCallback(() => {
    void client.invalidateQueries({ queryKey: QUERY_KEYS.avds(sdkRoot ?? "") });
    sources.refreshCandidates();
    setPicked(null);
    setCreateDevice(null);
  }, [client, sdkRoot, sources]);
  const flow = useInstallFlow({
    onStart: () => {
      sources.resetProgress();
      sources.clearLog();
    },
    onFinished: finished,
  });
  const installing = flow.stage.kind === "installing";

  const canInstall =
    sdkRoot !== null && catalog !== null && !installing && !flow.busy && emulatorError === null && (request === null || avd.nameError === null) && (packages.length > 0 || request !== null);

  const startInstall = useCallback(() => {
    if (!sdkRoot || !canInstall) return;
    const plan: InstallPlan = { sdkRoot, packages: packages.map((row) => row.path), avd: request };
    setQueued({ packages, avd: request?.name ?? null });
    flow.begin(plan, licensesFor(packages, new Set()));
  }, [canInstall, flow, packages, request, sdkRoot]);

  const phase = installingPhase(sources.progress, queued?.packages.length ?? 0);
  const queue = queued ? queueItems(queued.packages, phase, queued.avd) : [];

  return {
    support,
    sources,
    details,
    sdkRoot,
    sdk: { choices, value: sdkRoot, select: setPickedRoot },
    table: { tools: rows.tools, images: rows.images, selected, toggle, toggleAll },
    avd,
    wantsDevice,
    setCreateDevice,
    imageOptions,
    emulatorError,
    maxCores: Math.max(CORES.preferredMax, hardwareThreads()),
    summary,
    queue,
    installing,
    flow,
    canInstall,
    startInstall,
    openAccelDocs: () => {
      ipc.onboarding.openExternal(ACCEL_DOCS_URL).catch(() => undefined);
    },
  };
}

export type AndroidSettingsModel = ReturnType<typeof useAndroidSettings>;
