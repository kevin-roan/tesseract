import { useCallback, useMemo, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { Image } from "expo-image";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeIn, type SharedValue } from "react-native-reanimated";
import { ImageIcon, TextAaIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { Durations } from "@/theme";

import type { CropRect } from "@/modules/theone-island";

import { useCropBox } from "../../hooks/use-crop-box";
import { useCropHandle } from "../../hooks/use-crop-handle";
import type { CaptureImage, Corner, Size } from "../../types";
import createStyles, { ARMS } from "./styles";

type CropHandleProps = {
  corner: Corner;
  grabbed: SharedValue<Corner | null>;
  styles: ReturnType<typeof createStyles>;
};

const CropHandle = ({ corner, grabbed, styles }: CropHandleProps) => {
  const lift = useCropHandle(grabbed, corner);

  return (
    <Animated.View style={[styles.handle, styles[corner], lift]} accessibilityLabel={`Resize ${corner}`}>
      <View style={[styles.bracket, styles[ARMS[corner]]]} pointerEvents="none" />
    </Animated.View>
  );
};

type CropBoxProps = {
  image: CaptureImage;
  container: Size;
  onReady: (read: () => CropRect) => void;
};

const CropBox = ({ image, container, onReady }: CropBoxProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const crop = useCropBox(image, container);
  onReady(crop.readRect);

  return (
    <>
      <Image source={{ uri: image.uri }} contentFit="contain" style={styles.image} accessibilityIgnoresInvertColors />
      <Animated.View pointerEvents="none" style={[styles.dim, crop.dims.top]} />
      <Animated.View pointerEvents="none" style={[styles.dim, crop.dims.bottom]} />
      <Animated.View pointerEvents="none" style={[styles.dim, crop.dims.left]} />
      <Animated.View pointerEvents="none" style={[styles.dim, crop.dims.right]} />
      <GestureDetector gesture={crop.move}>
        <Animated.View
          entering={FadeIn.duration(Durations.normal)}
          style={[styles.box, crop.boxStyle]}
          accessibilityLabel="Crop area"
          accessibilityHint="Drag to move"
        >
          {crop.corners.map(({ corner, gesture }) => (
            <GestureDetector key={corner} gesture={gesture}>
              <CropHandle corner={corner} grabbed={crop.grabbed} styles={styles} />
            </GestureDetector>
          ))}
        </Animated.View>
      </GestureDetector>
    </>
  );
};

export type CropStepProps = {
  image: CaptureImage;
  busy: boolean;
  allowSkip: boolean;
  onUseImage: (rect: CropRect) => void;
  onGrabText: (rect: CropRect) => void;
  onSkip: () => void;
};

const CropStep = ({ image, busy, allowSkip, onUseImage, onGrabText, onSkip }: CropStepProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [container, setContainer] = useState<Size | null>(null);
  const [read, setRead] = useState<(() => CropRect) | null>(null);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainer((current) => (current && current.width === width && current.height === height ? current : { width, height }));
  }, []);
  const onReady = useCallback((next: () => CropRect) => setRead(() => next), []);

  return (
    <View style={styles.step}>
      <ThemedText variant="caption" color="textSecondary" style={styles.hint}>
        Drag the box or its corners to choose the part to keep.
      </ThemedText>
      <View style={styles.canvas} onLayout={onLayout} testID="crop-canvas">
        {container ? <CropBox image={image} container={container} onReady={onReady} /> : null}
      </View>
      <View style={styles.actions}>
        <View style={styles.action}>
          <ActionButton label="Use image" icon={ImageIcon} loading={busy} disabled={!read} onPress={() => read && onUseImage(read())} stretch />
        </View>
        <View style={styles.action}>
          <ActionButton
            label="Grab text"
            icon={TextAaIcon}
            variant="secondary"
            disabled={busy || !read}
            onPress={() => read && onGrabText(read())}
            stretch
          />
        </View>
      </View>
      {allowSkip ? <ActionButton label="Skip crop" variant="secondary" disabled={busy} onPress={onSkip} stretch /> : null}
    </View>
  );
};

export default CropStep;
