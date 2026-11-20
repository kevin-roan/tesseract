import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ModalSafeArea from "@/components/modal-safe-area";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useKeyboardHeight } from "@/hooks/use-keyboard-height";

import { useSheetEntrance } from "./hooks/use-sheet-entrance";
import { SheetHeader } from "./sheet-header";
import { SheetLift } from "./sheet-lift";
import createStyles from "./styles";

export { useSheetEntrance } from "./hooks/use-sheet-entrance";
export { SheetHeader, type SheetHeaderProps } from "./sheet-header";

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  onDismissed?: () => void;
  title?: string;
  closeLabel?: string;
  /** Lift the sheet above the keyboard, for sheets with text fields. */
  avoidKeyboard?: boolean;
  children: ReactNode;
  testID?: string;
};

/** Modal sheet on the paper: a round close button, the title centered, and the content below. */
const BottomSheet = ({
  visible,
  onClose,
  onDismissed,
  title,
  closeLabel = "Close",
  avoidKeyboard = false,
  children,
  testID,
}: BottomSheetProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const wasVisible = useRef(visible);
  const entering = useSheetEntrance();
  const keyboardHeight = useKeyboardHeight(avoidKeyboard && visible);

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
      <ModalSafeArea>
        {/* iOS lifts the sheet by the keyboard's own height: KeyboardAvoidingView inside a Modal leaves it under the keyboard there. */}
        <KeyboardAvoidingView
          style={styles.root}
          behavior="padding"
          enabled={avoidKeyboard && Platform.OS !== "ios"}
          testID={testID}
        >
          <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel} />
          <SheetLift keyboardHeight={keyboardHeight} entering={entering}>
            <SafeAreaView edges={["bottom"]} style={styles.sheet} accessibilityViewIsModal>
              <View style={styles.handle} />
              <SheetHeader title={title} onClose={onClose} closeLabel={closeLabel} />
              {children}
            </SafeAreaView>
          </SheetLift>
        </KeyboardAvoidingView>
      </ModalSafeArea>
    </Modal>
  );
};

export default BottomSheet;
