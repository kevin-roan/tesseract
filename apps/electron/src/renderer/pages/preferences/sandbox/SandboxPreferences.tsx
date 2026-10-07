import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { useNow } from "../../../onboarding/shared/use-now";
import { formatRelative } from "../../../onboarding/sandbox/model";
import { PreferencesPage } from "../shared/PreferencesPage";
import { BuildGroup } from "./BuildGroup";
import { DockerGroup } from "./DockerGroup";
import { useComponentsDraft } from "./hooks/use-components-draft";
import { useOpenSetup } from "./hooks/use-open-setup";
import { useRebuildConfirm } from "./hooks/use-rebuild-confirm";
import { useSandboxActions } from "./hooks/use-sandbox-actions";
import { useSandboxSources } from "./hooks/use-sandbox-sources";
import { SANDBOX_SETTINGS_LABELS as L } from "./labels";
import { buildActive, dockerReady } from "./model";
import { StackGroup } from "./StackGroup";
import { ToolsGroup } from "./ToolsGroup";

export default function SandboxPreferences() {
  const sources = useSandboxSources();
  const actions = useSandboxActions(sources.defaults, sources.clearLog);
  const draft = useComponentsDraft(sources.stack?.components ?? sources.defaults?.components ?? null);
  const confirm = useRebuildConfirm();
  const openSetup = useOpenSetup();
  const building = buildActive(sources.phase);
  const now = useNow(sources.phase.kind === "waiting");
  const canBuild = dockerReady(sources.docker) && sources.defaults !== null && !building && actions.pending === null;

  return (
    <PreferencesPage>
      <DockerGroup report={sources.docker} checking={sources.dockerChecking} onRecheck={sources.recheckDocker} onOpenSetup={() => openSetup("docker")} />
      <StackGroup
        stack={sources.stack}
        status={sources.status}
        pending={actions.pending}
        locked={building}
        autostart={actions.autostart}
        formatWhen={(iso) => formatRelative(iso, now)}
        onStart={actions.start}
        onStop={actions.stop}
        onAutostart={actions.setAutostart}
        onOpenSetup={() => openSetup("sandbox")}
      />
      {sources.phase.kind !== "idle" ? (
        <BuildGroup
          phase={sources.phase}
          fraction={sources.fraction}
          now={now}
          log={sources.log}
          cancelling={actions.pending === "cancel"}
          onCancel={actions.cancel}
        />
      ) : null}
      <ToolsGroup
        components={draft.components}
        flutterVersion={sources.defaults?.flutterVersion ?? ""}
        dirty={draft.dirty}
        disabled={!canBuild}
        rebuilding={actions.pending === "rebuild"}
        onToggle={draft.toggle}
        onReset={draft.reset}
        onRebuild={confirm.show}
      />
      <ConfirmDialog
        open={confirm.open}
        destructive={false}
        heading={L.rebuild.heading}
        body={L.rebuild.body}
        confirmLabel={L.rebuild.confirm}
        cancelLabel={L.rebuild.cancel}
        onConfirm={() => actions.rebuild(draft.components)}
        onClose={confirm.close}
      />
    </PreferencesPage>
  );
}
