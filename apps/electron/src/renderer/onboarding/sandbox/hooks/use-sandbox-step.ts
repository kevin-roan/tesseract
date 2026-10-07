import { useEffect, useRef, useState } from "react";
import type { OnboardingState } from "../../../../shared/contracts/onboarding";
import type { BuildMode } from "../../../../shared/contracts/sandbox";
import { useOnboardingNavigation, useReportStepStatus } from "../../shell";
import { BUILD_STEP_ID, PREBUILT_IMAGE_PUBLISHED, SANDBOX_COMPONENTS } from "../constants";
import {
  canStart,
  choicesForSource,
  diskStatus,
  footerMode,
  initialSource,
  isBuildRunning,
  nextStepAfter,
  resourceLimits,
  sourceAvailability,
  type FooterMode,
} from "../model";
import { useBuildActions } from "./use-build-actions";
import { useBuildTracker } from "./use-build-tracker";
import { useNow } from "../../shared/use-now";
import { useSandboxForm } from "./use-sandbox-form";
import { useExistingSandbox, useSandboxDefaults } from "./use-sandbox-sources";

export function useSandboxStep(state: OnboardingState) {
  const existing = useExistingSandbox().data ?? null;
  const tailscaleIp = useSandboxDefaults().data?.bindAddr ?? "";
  const form = useSandboxForm(state.choices);
  const [source, setSource] = useState<BuildMode>(() => initialSource(state.choices, existing));
  const [startedRevision, setStartedRevision] = useState(0);
  const sourcePicked = useRef(false);
  const available = sourceAvailability(existing, PREBUILT_IMAGE_PUBLISHED);

  useEffect(() => {
    if (sourcePicked.current || !existing) return;
    sourcePicked.current = true;
    setSource(initialSource(state.choices, existing));
  }, [existing, state.choices]);

  const sourceAvailable = available[source];
  useEffect(() => {
    if (!sourceAvailable) setSource("build");
  }, [sourceAvailable]);

  const phase = state.build;
  const track = useBuildTracker(phase);
  const running = isBuildRunning(phase);
  const now = useNow(running);
  const actions = useBuildActions();
  const navigation = useOnboardingNavigation();
  const edited = form.revision !== startedRevision;
  const rawMode = footerMode(phase);
  const mode: FooterMode = rawMode === "done" && edited ? "idle" : rawMode;
  const busy = running || actions.start.isPending || actions.adopt.isPending;
  const components = source === "pull" ? SANDBOX_COMPONENTS : form.choices.components;

  const stale = edited && phase.kind === "done";
  useReportStepStatus("sandbox", running ? "running" : stale ? "pending" : null);

  const start = (mode: BuildMode) => {
    setStartedRevision(form.revision);
    actions.start.mutate({
      choices: choicesForSource(form.choices, mode),
      mode,
    });
  };

  return {
    form,
    existing,
    tailscaleIp,
    source,
    setSource,
    available,
    phase,
    track,
    now,
    mode,
    busy,
    showBuild: phase.kind !== "idle" && mode !== "idle",
    log: state.log.build,
    disk: source === "existing" ? null : diskStatus(state.host, state.docker, components),
    limits: resourceLimits(state.host, state.docker),
    canStart: canStart(form.issues, form.validating),
    pending: actions.start.isPending || actions.adopt.isPending || actions.cancel.isPending,
    start: () => start(source),
    useExisting: () => {
      setStartedRevision(form.revision);
      actions.adopt.mutate();
    },
    cancel: () => actions.cancel.mutate(),
    proceed: () => navigation.goTo(nextStepAfter(BUILD_STEP_ID)),
    back: navigation.back,
    openTailscaleKeys: actions.openTailscaleKeys,
  };
}
