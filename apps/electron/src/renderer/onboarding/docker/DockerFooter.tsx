import { ActionButton } from "../../components/ActionButton";
import { OnboardingFooter } from "../shared/OnboardingFooter";
import { DOCKER_LABELS } from "./labels";
import type { DockerStepView } from "./use-docker-step";

export function DockerFooter({ view }: { view: DockerStepView }) {
  const labels = DOCKER_LABELS.buttons;
  const restart = view.panel === "relogin" || view.panel === "reboot";
  const installing = view.panel === "install";
  const back = <ActionButton variant="flat" size="dialog" label={labels.back} disabled={view.operation} onClick={view.navigation.back} />;

  if (restart) {
    return <OnboardingFooter start={back} end={<ActionButton variant="primary" size="dialog" label={labels.quit} onClick={view.quit} />} />;
  }

  const secondary = view.operation ? (
    <ActionButton variant="secondary" size="dialog" label={labels.cancel} onClick={view.docker.cancel} />
  ) : installing ? (
    <ActionButton variant="secondary" size="dialog" label={labels.cancel} onClick={view.closePanel} />
  ) : null;

  const primary = installing ? (
    <ActionButton variant="primary" size="dialog" label={labels.install} busy={view.operation} disabled={!view.canInstall} onClick={view.install} />
  ) : (
    <ActionButton variant="primary" size="dialog" label={labels.continue} disabled={!view.ready || view.operation} onClick={view.navigation.next} />
  );

  return (
    <OnboardingFooter
      start={back}
      end={
        <>
          {secondary}
          {primary}
        </>
      }
    />
  );
}
