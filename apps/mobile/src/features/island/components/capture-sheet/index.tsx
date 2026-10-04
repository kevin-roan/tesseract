import { useMemo } from "react";
import { Modal, View } from "react-native";
import Animated from "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import { useAppTheme } from "@/hooks/use-app-theme";

import { useCaptureFlow } from "../../hooks/use-capture-flow";
import { useIslandMotion } from "../../hooks/use-island-motion";
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

/** Full-screen capture flow: pick a source, crop (or read text from) the image, then choose where it goes. */
const CaptureSheet = () => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const flow = useCaptureFlow();
  const { step } = flow;
  const motion = useIslandMotion();

  return (
    <Modal visible={flow.visible && !flow.hidden} animationType="slide" onRequestClose={flow.back} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaView style={styles.safe} testID="capture-sheet">
          <ScreenHeader
            title={TITLES[step.kind]}
            subtitle={step.kind === "source" ? "Where should the image come from?" : undefined}
            onBack={flow.back}
            dismissible={step.kind === "source"}
          />
          <View style={styles.content}>
            {flow.error ? (
              <Animated.View entering={motion.fadeIn} exiting={motion.fadeOut}>
                <Notice tone="danger" message={flow.error} actionLabel="Dismiss" onAction={flow.dismissError} />
              </Animated.View>
            ) : null}
            <Animated.View key={step.kind} entering={motion.fadeIn} layout={motion.layout} style={styles.step}>
              {step.kind === "source" ? <CaptureSourceStep options={flow.options} disabled={flow.busy} onSelect={flow.pickSource} /> : null}
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
      </GestureHandlerRootView>
    </Modal>
  );
};

export default CaptureSheet;
