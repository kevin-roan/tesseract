import type { ClaudeAuthStatus } from "@tesseract/protocol";
import { SettingsGroup } from "../../../components/PreferenceRows";
import { BreakableText } from "../shared/BreakableText";
import { SHARED_LABELS } from "../shared/labels";
import { PropertyList } from "../shared/PropertyList";
import { RefreshButton } from "../shared/RefreshButton";
import { SECTION_LABELS } from "./labels";
import { sandboxAuthRows, sandboxDescription } from "./model";

export interface SandboxAuthGroupProps {
  auth: ClaudeAuthStatus | null;
  message: string | null;
  now: number;
  onRefresh(): void;
}

export function SandboxAuthGroup({ auth, message, now, onRefresh }: SandboxAuthGroupProps) {
  const items = auth ? sandboxAuthRows(auth, now) : [{ key: SHARED_LABELS.status, value: message || SHARED_LABELS.loading }];
  return (
    <SettingsGroup
      title={SECTION_LABELS.sandboxGroup}
      description={<BreakableText text={sandboxDescription(auth?.configDir)} />}
      headerSuffix={<RefreshButton onClick={onRefresh} />}
    >
      <PropertyList items={items} />
    </SettingsGroup>
  );
}
