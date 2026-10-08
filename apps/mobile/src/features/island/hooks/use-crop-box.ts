import { useCallback, useEffect, useMemo } from "react";
import { Gesture } from "react-native-gesture-handler";
import { useAnimatedStyle, useSharedValue } from "react-native-reanimated";

import type { CropRect } from "@/modules/tesseract-island";

import type { Corner, FitGeometry, Rect, Size } from "../types";
import { CORNERS, CROP_HANDLE_SIZE } from "../utils/constants";
import { clampRect, fitImage, initialCrop, moveRect, resizeFromCorner, screenToImage } from "../utils/crop";

/** Shared-value crop rectangle over a letterboxed image, with a pan to move and four corner pans to resize. */
export function useCropBox(image: Size, container: Size) {
  const fit = useMemo<FitGeometry>(() => fitImage(image, container), [image, container]);
  const bounds = useSharedValue<Rect>({ x: fit.x, y: fit.y, width: fit.width, height: fit.height });
  const rect = useSharedValue<Rect>(initialCrop(fit));
  const origin = useSharedValue<Rect>(rect.get());
  const grabbed = useSharedValue<Corner | null>(null);

  useEffect(() => {
    const next = { x: fit.x, y: fit.y, width: fit.width, height: fit.height };
    bounds.set(next);
    rect.set(initialCrop(next));
  }, [fit, bounds, rect]);

  const move = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          origin.set(rect.get());
        })
        .onUpdate((event) => {
          rect.set(moveRect(origin.get(), event.translationX, event.translationY, bounds.get()));
        }),
    [origin, rect, bounds],
  );

  const cornerGesture = useCallback(
    (corner: Corner) =>
      Gesture.Pan()
        .hitSlop(CROP_HANDLE_SIZE / 2)
        .onBegin(() => {
          origin.set(rect.get());
          grabbed.set(corner);
        })
        .onUpdate((event) => {
          rect.set(clampRect(resizeFromCorner(origin.get(), corner, event.translationX, event.translationY, bounds.get()), bounds.get()));
        })
        .onFinalize(() => {
          grabbed.set(null);
        }),
    [origin, rect, bounds, grabbed],
  );

  const corners = useMemo(() => CORNERS.map((corner) => ({ corner, gesture: cornerGesture(corner) })), [cornerGesture]);

  const boxStyle = useAnimatedStyle(() => {
    const value = rect.get();
    return { left: value.x, top: value.y, width: value.width, height: value.height };
  });

  const dimTop = useAnimatedStyle(() => ({ left: 0, top: 0, right: 0, height: rect.get().y }));
  const dimBottom = useAnimatedStyle(() => {
    const value = rect.get();
    return { left: 0, top: value.y + value.height, right: 0, bottom: 0 };
  });
  const dimLeft = useAnimatedStyle(() => {
    const value = rect.get();
    return { left: 0, top: value.y, width: value.x, height: value.height };
  });
  const dimRight = useAnimatedStyle(() => {
    const value = rect.get();
    return { left: value.x + value.width, top: value.y, right: 0, height: value.height };
  });

  const readRect = useCallback((): CropRect => {
    const value = screenToImage(rect.get(), fit);
    return clampRect(value, { x: 0, y: 0, width: image.width, height: image.height }, 1);
  }, [rect, fit, image]);

  return { fit, move, corners, grabbed, boxStyle, dims: { top: dimTop, bottom: dimBottom, left: dimLeft, right: dimRight }, readRect };
}
