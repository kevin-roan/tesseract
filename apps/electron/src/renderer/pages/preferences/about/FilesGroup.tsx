import type { AppPaths } from "../../../../shared/contracts/app";
import { IconButton } from "../../../components/IconButton";
import { PropertyRow, SettingsGroup } from "../../../components/PreferenceRows";
import { ABOUT_LABELS } from "./labels";

export function FilesGroup({ paths, onReveal }: { paths: AppPaths; onReveal(path: string): void }) {
  const F = ABOUT_LABELS.files;
  const rows = [
    { title: F.config, path: paths.configFile },
    { title: F.logs, path: paths.logs },
    { title: F.data, path: paths.userData },
  ];
  return (
    <SettingsGroup title={F.title}>
      {rows.map((row) => (
        <PropertyRow
          key={row.title}
          title={row.title}
          value={row.path}
          selectable
          suffix={<IconButton icon="empty" label={F.show} onClick={() => onReveal(row.path)} />}
        />
      ))}
    </SettingsGroup>
  );
}
