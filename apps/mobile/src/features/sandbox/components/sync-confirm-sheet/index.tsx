import { useMemo } from "react";
import { ScrollView } from "react-native";
import { ArrowLineUpIcon } from "phosphor-react-native";
import type { SyncFileChange } from "@theone/protocol";

import ActionButton from "@/components/action-button";
import BottomSheet from "@/components/bottom-sheet";
import { ListGroup, ListSwitchRow } from "@/components/list-group";
import Notice from "@/components/notice";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import { pluralize } from "../../utils/format";
import SyncFileRow from "../sync-file-row";
import createStyles from "./styles";

export type SyncConfirmSheetProps = {
  visible: boolean;
  changes: SyncFileChange[];
  message: string;
  showForce: boolean;
  force: boolean;
  onForceChange: (force: boolean) => void;
  onConfirm: () => void;
  onClose: () => void;
  submitting: boolean;
  error: string | null;
};

const SyncConfirmSheet = ({
  visible,
  changes,
  message,
  showForce,
  force,
  onForceChange,
  onConfirm,
  onClose,
  submitting,
  error,
}: SyncConfirmSheetProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Sync to host" testID="sync-confirm-sheet">
      <ThemedText variant="bodySmall" color="textSecondary" style={styles.message}>
        {message}
      </ThemedText>
      <ScrollView style={styles.files}>
        <ListGroup dividerInset="text">
          {changes.map((change) => (
            <SyncFileRow key={change.path} change={change} />
          ))}
        </ListGroup>
      </ScrollView>
      {showForce ? (
        <ListGroup footnote="The last sync stopped because files changed on your computer. Turn this on to replace them.">
          <ListSwitchRow label="Overwrite host edits" value={force} onValueChange={onForceChange} />
        </ListGroup>
      ) : null}
      {error ? <Notice tone="danger" message={error} /> : null}
      <ActionButton
        label={`Sync ${pluralize(changes.length, "file")}`}
        icon={ArrowLineUpIcon}
        onPress={onConfirm}
        loading={submitting}
        stretch
      />
    </BottomSheet>
  );
};

export default SyncConfirmSheet;
