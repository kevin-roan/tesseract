import { runtime } from "../../../app/runtime";
import { useNow } from "../../../onboarding/shared/use-now";
import { PreferencesPage } from "../shared/PreferencesPage";
import { AboutHero } from "./AboutHero";
import { CliGroup } from "./CliGroup";
import { FilesGroup } from "./FilesGroup";
import { useAppPaths } from "./hooks/use-app-paths";
import { useCliInstall } from "./hooks/use-cli-install";
import { useUpdates } from "./hooks/use-updates";
import { ABOUT_LABELS } from "./labels";
import { cliView, updateView } from "./model";
import { UpdatesGroup } from "./UpdatesGroup";

export default function AboutPreferences() {
  const updates = useUpdates();
  const cli = useCliInstall();
  const files = useAppPaths();
  const now = useNow(false);
  const version = ABOUT_LABELS.version(runtime.version, ABOUT_LABELS.platforms[runtime.platform], runtime.arch);
  return (
    <PreferencesPage>
      <AboutHero version={version} />
      <UpdatesGroup view={updateView(updates.state, now)} onAction={updates.run} />
      <CliGroup view={cliView(cli.status)} installing={cli.installing} onInstall={cli.install} />
      {files.paths ? <FilesGroup paths={files.paths} onReveal={files.reveal} /> : null}
    </PreferencesPage>
  );
}
