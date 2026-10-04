import { useMemo } from "react";
import { ScrollView } from "react-native";
import type { Icon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import BottomSheet from "@/components/bottom-sheet";
import { ListGroup, ListSwitchRow } from "@/components/list-group";
import Notice from "@/components/notice";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import type { SyncSheetView } from "../../utils/sync";
import SyncFileRow from "../sync-file-row";
import createStyles from "./styles";

export type SyncConfirmSheetProps = {
  visible: boolean;
  view: SyncSheetView & { icon: Icon };
  selected?: ReadonlySet<string>;
  onToggleFile?: (path: string) => void;
  force: boolean;
  onForceChange: (force: boolean) => void;
  onConfirm: () => void;
  onClose: () => void;
  submitting: boolean;
  disabled?: boolean;
  error: string | null;
};

const SyncConfirmSheet = ({
  visible,
  view,
  selected,
  onToggleFile,
  force,
  onForceChange,
  onConfirm,
  onClose,
  submitting,
  disabled = false,
  error,
}: SyncConfirmSheetProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={view.title} testID="sync-confirm-sheet">
      <ThemedText variant="bodySmall" color="textSecondary" style={styles.message}>
        {view.message}
      </ThemedText>
      {view.files.length > 0 ? (
        <ScrollView style={styles.files}>
          <ListGroup dividerInset="text">
            {view.files.map((change) => (
              <SyncFileRow
                key={change.path}
                change={change}
                selected={view.selectable ? (selected?.has(change.path) ?? false) : undefined}
                onPress={view.selectable && onToggleFile ? () => onToggleFile(change.path) : undefined}
              />
            ))}
          </ListGroup>
        </ScrollView>
      ) : null}
      {view.force ? (
        <ListGroup footnote={view.force.footnote}>
          <ListSwitchRow label={view.force.label} value={force} onValueChange={onForceChange} />
        </ListGroup>
      ) : null}
      {error ? <Notice tone="danger" message={error} /> : null}
      <ActionButton
        label={view.confirmLabel}
        icon={view.icon}
        variant={view.destructive ? "danger" : "primary"}
        onPress={onConfirm}
        loading={submitting}
        disabled={disabled}
        stretch
      />
    </BottomSheet>
  );
};

export default SyncConfirmSheet;
