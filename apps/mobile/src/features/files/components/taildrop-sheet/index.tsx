import { DeviceMobileIcon, WarningIcon } from "phosphor-react-native";
import type { TaildropTarget } from "@theone/protocol";

import EmptyState from "@/components/empty-state";
import GlassSheet from "@/components/glass-sheet";
import ListCard from "@/components/list-card";
import Notice from "@/components/notice";

import { taildropTargetSubtitle } from "../../utils/describe";

export type TaildropSheetProps = {
  fileName: string | null;
  targets: TaildropTarget[];
  loading?: boolean;
  sendingTargetId?: string | null;
  error?: string | null;
  onSelect: (targetId: string) => void;
  onClose: () => void;
};

const TaildropSheet = ({ fileName, targets, loading = false, sendingTargetId = null, error, onSelect, onClose }: TaildropSheetProps) => (
  <GlassSheet
    visible={fileName !== null}
    onClose={onClose}
    title="Send with Taildrop"
    subtitle={fileName ?? undefined}
    testID="taildrop-sheet"
  >
    {error ? <Notice tone="danger" icon={WarningIcon} message={error} /> : null}
    {loading ? (
      <EmptyState loading title="Looking for devices…" />
    ) : targets.length === 0 ? (
      <EmptyState
        icon={DeviceMobileIcon}
        title="No devices can receive files"
        message="Devices on your tailnet that accept Taildrop show up here."
      />
    ) : (
      targets.map((target) => (
        <ListCard
          key={target.id}
          icon={DeviceMobileIcon}
          title={target.hostName}
          subtitle={sendingTargetId === target.id ? "Sending…" : taildropTargetSubtitle(target)}
          onPress={target.online && sendingTargetId === null ? () => onSelect(target.id) : undefined}
        />
      ))
    )}
  </GlassSheet>
);

export default TaildropSheet;
