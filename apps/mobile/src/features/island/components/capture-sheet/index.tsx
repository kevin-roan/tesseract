import { useMemo } from "react";
import { Modal, Pressable, View } from "react-native";
import Animated from "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { XIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLayoutMotion } from "@/hooks/use-layout-motion";
import { SchemeOverrideContext } from "@/hooks/use-scheme-override";

import { useCaptureFlow } from "../../hooks/use-capture-flow";
import { useIslandDrop } from "../../hooks/use-island-drop";
import type { CaptureStep } from "../../types";
import { ISLAND_SCHEMES } from "../../utils/constants";
import CaptureSourceStep from "../capture-source-step";
import CropStep from "../crop-step";
import TextConfirmStep from "../text-confirm-step";
import createStyles from "./styles";

const TITLES: Record<CaptureStep["kind"], string> = {
  source: "Capture",
  crop: "Crop",
  text: "Grab text",
};

type CaptureCardProps = { flow: ReturnType<typeof useCaptureFlow> };

const CaptureCard = ({ flow }: CaptureCardProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { step } = flow;
  const motion = useLayoutMotion();
  const entering = useIslandDrop();
  const insets = useSafeAreaInsets();
  // The source list hugs its content; crop and text need the room, so the card grows down to the bottom safe area.
  const picking = step.kind === "source";

  return (
    <GestureHandlerRootView style={[styles.root, { paddingTop: insets.top + theme.spacing.xs, paddingBottom: insets.bottom + theme.spacing.sm }]}>
      <Pressable style={styles.scrim} onPress={flow.back} disabled={!picking} accessibilityRole="button" accessibilityLabel="Close" />
      <Animated.View
        entering={entering}
        layout={motion.layout}
        style={[styles.card, !picking && styles.expanded]}
        testID="capture-sheet"
        accessibilityViewIsModal
      >
        {/* Picking closes from the trailing corner; later steps step back from the leading one. */}
        <View style={styles.header}>
          <ScreenHeader
            title={TITLES[step.kind]}
            subtitle={picking ? "Where should the image come from?" : undefined}
            onBack={picking ? undefined : flow.back}
            actions={picking ? [{ id: "close", icon: XIcon, label: "Close", onPress: flow.back }] : undefined}
          />
        </View>
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
      </Animated.View>
    </GestureHandlerRootView>
  );
};

/** Capture flow as a floating card that drops out of the Dynamic Island over the live app: pick a source, crop (or read text from) the image, then choose where it goes. */
const CaptureSheet = () => {
  const theme = useAppTheme();
  const flow = useCaptureFlow();

  return (
    <Modal
      visible={flow.visible && !flow.hidden}
      transparent
      animationType="fade"
      onRequestClose={flow.back}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <SchemeOverrideContext.Provider value={ISLAND_SCHEMES[theme.scheme]}>
        <CaptureCard flow={flow} />
      </SchemeOverrideContext.Provider>
    </Modal>
  );
};

export default CaptureSheet;
