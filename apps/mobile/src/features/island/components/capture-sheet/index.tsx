import { useMemo } from "react";
import { Modal, Pressable, View } from "react-native";
import Animated from "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useSheetEntrance } from "@/components/bottom-sheet";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLayoutMotion } from "@/hooks/use-layout-motion";

import { useCaptureFlow } from "../../hooks/use-capture-flow";
import type { CaptureStep } from "../../types";
import CaptureSourceStep from "../capture-source-step";
import CropStep from "../crop-step";
import TextConfirmStep from "../text-confirm-step";
import createStyles from "./styles";

const TITLES: Record<CaptureStep["kind"], string> = {
  source: "Capture",
  crop: "Crop",
  text: "Grab text",
};

/** Capture flow as a sheet over the dimmed app: pick a source, crop (or read text from) the image, then choose where it goes. */
const CaptureSheet = () => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const flow = useCaptureFlow();
  const { step } = flow;
  const motion = useLayoutMotion();
  const entering = useSheetEntrance();
  const insets = useSafeAreaInsets();
  // The source list hugs its content; crop and text need the room, so the sheet grows to just below the status bar.
  const picking = step.kind === "source";

  return (
    <Modal
      visible={flow.visible && !flow.hidden}
      transparent
      animationType="fade"
      onRequestClose={flow.back}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <GestureHandlerRootView style={styles.root}>
        <Pressable
          style={styles.scrim}
          onPress={flow.back}
          disabled={!picking}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <Animated.View entering={entering} style={picking ? null : [styles.expanded, { marginTop: insets.top + theme.spacing.base }]}>
          <SafeAreaView edges={["bottom"]} style={[styles.sheet, !picking && styles.expanded]} testID="capture-sheet" accessibilityViewIsModal>
            <ScreenHeader
              title={TITLES[step.kind]}
              subtitle={picking ? "Where should the image come from?" : undefined}
              onBack={flow.back}
              dismissible={picking}
            />
            <View style={[styles.content, !picking && styles.expanded]}>
              {flow.error ? (
                <Animated.View entering={motion.fadeIn} exiting={motion.fadeOut}>
                  <Notice tone="danger" message={flow.error} actionLabel="Dismiss" onAction={flow.dismissError} />
                </Animated.View>
              ) : null}
              <Animated.View key={step.kind} entering={motion.fadeIn} layout={motion.layout} style={!picking && styles.expanded}>
                {picking ? <CaptureSourceStep options={flow.options} disabled={flow.busy} onSelect={flow.pickSource} /> : null}
                {step.kind === "crop" ? (
                  <CropStep
                    image={step.image}
                    busy={flow.busy}
                    allowSkip
                    onUseImage={flow.useImage}
                    onGrabText={flow.grabText}
                    onSkip={flow.skipCrop}
                  />
                ) : null}
                {step.kind === "text" ? <TextConfirmStep key={step.text} initialText={step.text} onConfirm={flow.confirmText} /> : null}
              </Animated.View>
            </View>
          </SafeAreaView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
};

export default CaptureSheet;
