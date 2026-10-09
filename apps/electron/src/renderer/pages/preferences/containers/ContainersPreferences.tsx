import { CloudflareGroup } from "../../containers/shared/CloudflareGroup";
import { PreferencesPage } from "../shared/PreferencesPage";
import { ChecksGroup } from "./ChecksGroup";
import { TailscaleGroup } from "./TailscaleGroup";

export default function ContainersPreferences() {
  return (
    <PreferencesPage>
      <ChecksGroup />
      <TailscaleGroup />
      <CloudflareGroup />
    </PreferencesPage>
  );
}
