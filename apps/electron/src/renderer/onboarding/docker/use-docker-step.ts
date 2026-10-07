import { useState } from "react";
import type { DockerActionKey, DockerInstallOption } from "../../../shared/contracts/docker";
import { currentPlatform } from "../../app/runtime";
import { ipc } from "../../lib/ipc";
import { useOnboardingNavigation, useOnboardingState, useReportStepStatus, type OnboardingNavigation } from "../shell";
import { BROWSER_OPTIONS, DOCS_ACTIONS, INSTALL_ACTIONS, START_TICK_MS } from "./constants";
import {
  blockedReason,
  checkViews,
  installChoices,
  installProgress,
  isBusy,
  isOperation,
  isReady,
  needsLicense,
  panelFor,
  rebootSubject,
  stepStatus,
  type CheckView,
  type DockerPanel,
  type InstallChoice,
  type ProgressView,
} from "./model";
import { useDocker, type DockerController } from "./use-docker";
import { useNow } from "../shared/use-now";

export interface DockerStepView {
  docker: DockerController;
  navigation: OnboardingNavigation;
  rows: CheckView[];
  panel: DockerPanel;
  ready: boolean;
  busy: boolean;
  operation: boolean;
  notice: string | null;
  manualCommands: readonly string[];
  progress: ProgressView | null;
  choices: InstallChoice[];
  option: DockerInstallOption;
  accepted: boolean;
  licenseRequired: boolean;
  canInstall: boolean;
  rebootSubject: string;
  runAction(action: DockerActionKey): void;
  selectOption(option: DockerInstallOption): void;
  setAccepted(accepted: boolean): void;
  install(): void;
  addToGroup(): void;
  closePanel(): void;
  quit(): void;
}

export function useDockerStep(): DockerStepView {
  const docker = useDocker();
  const navigation = useOnboardingNavigation();
  const state = useOnboardingState();
  const platform = currentPlatform();
  const choices = installChoices(platform, state?.host ?? null);
  const [requested, setRequested] = useState<DockerPanel>("none");
  const [option, setOption] = useState<DockerInstallOption>(choices[0]?.option ?? "manual");
  const [accepted, setAccepted] = useState(false);
  const { report, phase } = docker;
  const now = useNow(phase.kind === "starting", START_TICK_MS);
  const ready = isReady(report, phase, platform);
  const operation = isOperation(phase);
  const licenseRequired = needsLicense(option);
  useReportStepStatus("docker", stepStatus(report, phase, platform));

  const runAction = (action: DockerActionKey) => {
    const docs = DOCS_ACTIONS[action];
    const installOption = INSTALL_ACTIONS[action];
    if (docs) docker.openUrl(docs);
    else if (installOption) docker.install({ option: installOption, acceptLicense: false });
    else if (action === "start") docker.start();
    else if (action === "install") setRequested("install");
    else if (action === "fix-permission") setRequested("permission");
  };

  const install = () => {
    docker.install({ option, acceptLicense: licenseRequired && accepted });
    if (BROWSER_OPTIONS.includes(option)) setRequested("none");
  };

  return {
    docker,
    navigation,
    rows: checkViews(report, phase, now),
    panel: panelFor(phase, requested),
    ready,
    busy: isBusy(phase) || docker.checking,
    operation,
    notice: docker.error ?? blockedReason(report, phase),
    manualCommands: phase.kind === "blocked" ? (phase.commands ?? []) : [],
    progress: installProgress(phase),
    choices,
    option,
    accepted,
    licenseRequired,
    canInstall: !operation && (!licenseRequired || accepted),
    rebootSubject: rebootSubject(report),
    runAction,
    selectOption: setOption,
    setAccepted,
    install,
    addToGroup: () => docker.install({ option: "docker-group", acceptLicense: false }),
    closePanel: () => setRequested("none"),
    quit: () => void ipc.app.quit().catch(() => undefined),
  };
}
