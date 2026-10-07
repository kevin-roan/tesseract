import { Notice } from "../../components/Notice";
import { Reveal } from "../../components/Reveal";
import { StepHero } from "../shared/StepHero";
import { CommandBlock, LogDisclosure } from "../shell";
import styles from "./DockerStep.module.css";
import { DockerChecks } from "./DockerChecks";
import { DockerFooter } from "./DockerFooter";
import { InstallPanel } from "./InstallPanel";
import { DOCKER_LABELS } from "./labels";
import { PermissionPanel } from "./PermissionPanel";
import { RestartPanel } from "./RestartPanel";
import { useDockerStep } from "./use-docker-step";

export default function DockerStep() {
  const view = useDockerStep();
  const { docker } = view;
  return (
    <>
      <StepHero icon="docker" title={DOCKER_LABELS.title} description={DOCKER_LABELS.description} />
      <Reveal open={view.notice !== null && view.panel === "none"}>
        <Notice tone="danger" message={view.notice ?? ""} actionLabel={DOCKER_LABELS.checkAgain} onAction={docker.check} />
      </Reveal>
      <Reveal open={view.manualCommands.length > 0}>
        <div className={styles.commands}>
          {view.manualCommands.map((command) => (
            <CommandBlock key={command} command={command} />
          ))}
        </div>
      </Reveal>
      <Reveal open={view.panel === "relogin" || view.panel === "reboot"}>
        <RestartPanel kind={view.panel === "reboot" ? "reboot" : "relogin"} subject={view.rebootSubject} />
      </Reveal>
      <DockerChecks rows={view.rows} busy={view.busy} disabled={view.operation} onCheck={docker.check} onAction={view.runAction} />
      <Reveal open={view.panel === "install"}>
        <InstallPanel
          choices={view.choices}
          option={view.option}
          licenseRequired={view.licenseRequired}
          accepted={view.accepted}
          locked={view.operation}
          progress={view.progress}
          onSelect={view.selectOption}
          onAccept={view.setAccepted}
          onReadLicense={() => docker.openUrl("docker_ssa")}
        />
      </Reveal>
      <Reveal open={view.panel === "permission"}>
        <PermissionPanel busy={view.operation} onAddToGroup={view.addToGroup} />
      </Reveal>
      {docker.log.length > 0 ? <LogDisclosure lines={docker.log} /> : null}
      <DockerFooter view={view} />
    </>
  );
}
