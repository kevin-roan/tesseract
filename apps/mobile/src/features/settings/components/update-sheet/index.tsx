import { useMemo } from "react";
import { View } from "react-native";
import { DownloadSimpleIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import BottomSheet from "@/components/bottom-sheet";
import Notice from "@/components/notice";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type UpdateSheetProps = {
  visible: boolean;
  title: string;
  message: string;
  detail?: string | null;
  installLabel: string;
  laterLabel: string;
  installing: boolean;
  error?: string | null;
  errorTitle?: string;
  onInstall: () => void;
  onClose: () => void;
};

const UpdateSheet = ({
  visible,
  title,
  message,
  detail,
  installLabel,
  laterLabel,
  installing,
  error,
  errorTitle,
  onInstall,
  onClose,
}: UpdateSheetProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} testID="update-sheet">
      <View style={styles.body}>
        <ThemedText variant="bodySmall" color="textSecondary">
          {message}
        </ThemedText>
        {detail ? (
          <ThemedText variant="caption" color="textTertiary">
            {detail}
          </ThemedText>
        ) : null}
      </View>
      {error ? <Notice tone="danger" title={errorTitle} message={error} /> : null}
      <ActionButton
        label={installLabel}
        icon={DownloadSimpleIcon}
        onPress={onInstall}
        loading={installing}
        disabled={installing}
        stretch
        testID="update-sheet-install"
      />
      <ActionButton
        label={laterLabel}
        variant="secondary"
        onPress={onClose}
        disabled={installing}
        stretch
        testID="update-sheet-later"
      />
    </BottomSheet>
  );
};

export default UpdateSheet;
