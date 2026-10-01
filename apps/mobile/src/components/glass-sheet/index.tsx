import { useMemo, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SheetHeader } from "@/components/bottom-sheet";
import { useAppTheme } from "@/hooks/use-app-theme";

import { SHEET_ORIENTATIONS } from "./config";
import createStyles from "./styles";

export type GlassSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  closeLabel?: string;
  children?: ReactNode;
  testID?: string;
};

/** Scrolling bottom sheet on the paper, with a round close button and a centered title. Tapping the backdrop or the system back gesture closes it. */
const GlassSheet = ({ visible, onClose, title, subtitle, closeLabel = "Close", children, testID }: GlassSheetProps) => {
  const theme = useAppTheme();
  const { bottom } = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, bottom), [theme, bottom]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={SHEET_ORIENTATIONS}
      onRequestClose={onClose}
    >
      <View style={styles.root} testID={testID}>
        <Pressable style={styles.backdrop} accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.header}>
            <SheetHeader title={title} subtitle={subtitle} onClose={onClose} closeLabel={closeLabel} />
          </View>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default GlassSheet;
