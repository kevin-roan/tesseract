import { useCallback, useEffect, useRef, useState } from "react";

import { clipboardHasImage, clipboardText, pasteFromClipboard } from "@/features/attachments/services/clipboard";
import { pickFromLibrary } from "@/features/attachments/services/pickers";
import type { PickedFile } from "@/features/attachments/types";
import { describeError } from "@/features/sandbox/utils/errors";

import { canCaptureScreen, captureScreen, cropImage, recognizeText, type CropRect } from "@/modules/tesseract-island";

import { captureImageFromFile } from "../services/image-size";
import { useIslandStore } from "../store/island-store";
import type { CaptureImage, CaptureSeed, CaptureSource, CaptureStep } from "../types";
import { captureImageFrom, captureOptions } from "../utils/capture";
import { CAPTURE_HIDE_DELAY_MS, CAPTURE_IMAGE_MIME_TYPE } from "../utils/constants";
import { isFullImage } from "../utils/crop";
import { captureImageToFile, mergeDraftText } from "../utils/shared";

export type CaptureFlowState = ReturnType<typeof useCaptureFlow>;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Collected = { files: PickedFile[]; text: string; queue: PickedFile[]; seed: CaptureSeed | null };

const emptyCollected = (): Collected => ({ files: [], text: "", queue: [], seed: null });

export function useCaptureFlow() {
  const visible = useIslandStore((state) => state.captureOpen);
  const seed = useIslandStore((state) => state.captureSeed);
  const closeCapture = useIslandStore((state) => state.closeCapture);
  const openAttach = useIslandStore((state) => state.openAttach);
  const [step, setStep] = useState<CaptureStep>({ kind: "source" });
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const collected = useRef<Collected>(emptyCollected());

  const finish = useCallback(() => {
    const { files, text, seed: origin } = collected.current;
    collected.current = emptyCollected();
    setStep({ kind: "source" });
    setError(null);
    if (files.length === 0 && !text.trim()) {
      closeCapture();
      return;
    }
    openAttach({ text: text.trim() || null, files, source: origin?.source ?? "capture" });
  }, [closeCapture, openAttach]);

  const showCrop = useCallback((image: CaptureImage) => {
    setStep({ kind: "crop", image });
  }, []);

  /** Crops the next queued image, attaching as-is any file whose size cannot be read; finishes when the queue is empty. */
  const next = useCallback(async () => {
    for (let queued = collected.current.queue.shift(); queued; queued = collected.current.queue.shift()) {
      const image = await captureImageFromFile(queued);
      if (image) {
        showCrop(image);
        return;
      }
      collected.current.files.push(queued);
    }
    finish();
  }, [finish, showCrop]);

  useEffect(() => {
    if (!visible || !seed) return;
    collected.current = { files: [...seed.files], text: seed.text ?? "", queue: [...seed.images], seed };
    void next();
  }, [visible, seed, next]);

  const close = useCallback(() => {
    collected.current = emptyCollected();
    setStep({ kind: "source" });
    setError(null);
    setHidden(false);
    closeCapture();
  }, [closeCapture]);

  const run = useCallback(async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
      setHidden(false);
    }
  }, []);

  const pickSource = useCallback(
    (source: CaptureSource) =>
      run(async () => {
        if (source === "app" || source === "screen") {
          if (source === "app") {
            setHidden(true);
            await wait(CAPTURE_HIDE_DELAY_MS);
          }
          showCrop(captureImageFrom(await captureScreen(source)));
          return;
        }
        if (source === "library") {
          const [file] = await pickFromLibrary(1);
          if (!file) return;
          const image = await captureImageFromFile(file);
          if (image) showCrop(image);
          else throw new Error("That file is not an image.");
          return;
        }
        if (await clipboardHasImage()) {
          const [file] = await pasteFromClipboard();
          const image = file ? await captureImageFromFile(file) : null;
          if (image) showCrop(image);
          return;
        }
        const text = await clipboardText();
        if (!text) throw new Error("There's nothing on the clipboard to attach.");
        collected.current.text = mergeDraftText(collected.current.text, text);
        finish();
      }),
    [run, showCrop, finish],
  );

  const cropped = useCallback(async (image: CaptureImage, rect: CropRect) => {
    if (isFullImage(rect, image)) return image;
    return captureImageFrom(await cropImage(image.uri, rect), image.name);
  }, []);

  const useImage = useCallback(
    (rect: CropRect) => {
      if (step.kind !== "crop") return;
      const { image } = step;
      return run(async () => {
        collected.current.files.push(captureImageToFile(await cropped(image, rect), CAPTURE_IMAGE_MIME_TYPE));
        await next();
      });
    },
    [step, run, cropped, next],
  );

  const skipCrop = useCallback(() => {
    if (step.kind !== "crop") return;
    collected.current.files.push(captureImageToFile(step.image, CAPTURE_IMAGE_MIME_TYPE));
    void next();
  }, [step, next]);

  const grabText = useCallback(
    (rect: CropRect) => {
      if (step.kind !== "crop") return;
      const { image } = step;
      return run(async () => {
        const region = await cropped(image, rect);
        const recognized = await recognizeText(region.uri);
        if (!recognized.text.trim()) throw new Error("No text was found in that area.");
        setStep({ kind: "text", image, text: recognized.text });
      });
    },
    [step, run, cropped],
  );

  const confirmText = useCallback(
    (text: string) => {
      collected.current.text = mergeDraftText(collected.current.text, text.trim() || null);
      void next();
    },
    [next],
  );

  const back = useCallback(() => {
    if (step.kind === "text") setStep({ kind: "crop", image: step.image });
    else if (step.kind === "crop" && !collected.current.seed) setStep({ kind: "source" });
    else close();
  }, [step, close]);

  const dismissError = useCallback(() => setError(null), []);

  return {
    visible,
    hidden,
    step,
    busy,
    error,
    options: captureOptions(canCaptureScreen("screen")),
    pickSource,
    useImage,
    skipCrop,
    grabText,
    confirmText,
    back,
    close,
    dismissError,
  };
}
