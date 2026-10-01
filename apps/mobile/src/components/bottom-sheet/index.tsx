import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Modal, Platform, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppTheme } from "@/hooks/use-app-theme";

import { SheetHeader } from "./sheet-header";
import createStyles from "./styles";

export { SheetHeader, type SheetHeaderProps } from "./sheet-header";

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  onDismissed?: () => void;
  title?: string;
  closeLabel?: string;
  children: ReactNode;
  testID?: string;
};

/** Modal sheet on the paper: a round close button, the title centered, and the content below. */
const BottomSheet = ({ visible, onClose, onDismissed, title, closeLabel = "Close", children, testID }: BottomSheetProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const wasVisible = useRef(visible);

  useEffect(() => {
    if (wasVisible.current && !visible && Platform.OS !== "ios") onDismissed?.();
    wasVisible.current = visible;
  }, [visible, onDismissed]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={Platform.OS === "ios" ? onDismissed : undefined}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.root} testID={testID}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel} />
        <SafeAreaView edges={["bottom"]} style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.handle} />
          <SheetHeader title={title} onClose={onClose} closeLabel={closeLabel} />
          {children}
        </SafeAreaView>
      </View>
    </Modal>
  );
};

export default BottomSheet;
