import type { PickedFile } from "@/features/attachments/types";

export type DraftSource = "capture" | "share";

/** What the island hands to the next chat composer on screen. */
export type AttachDraft = {
  text: string | null;
  files: PickedFile[];
  source: DraftSource;
};

export type CaptureSource = "app" | "screen" | "library" | "clipboard";

/** Material the capture flow starts with, e.g. images from the share sheet that still need cropping. */
export type CaptureSeed = {
  images: PickedFile[];
  text: string | null;
  files: PickedFile[];
  source: DraftSource;
};

export type CaptureStep =
  | { kind: "source" }
  | { kind: "crop"; image: CaptureImage }
  | { kind: "text"; image: CaptureImage; text: string };

export type CaptureImage = {
  uri: string;
  width: number;
  height: number;
  name: string;
};

export type CaptureOption = {
  id: CaptureSource;
  label: string;
  description: string;
};

export type AttachDestination =
  | { kind: "new-chat"; id: "new-chat"; label: string; detail: string }
  | { kind: "project"; id: string; label: string; detail: string }
  | { kind: "chat"; id: string; label: string; detail: string };

export type Size = { width: number; height: number };

export type Rect = { x: number; y: number; width: number; height: number };

export type Corner = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

/** Where the in-app island orb sits, or `hidden` to leave live work to the Dynamic Island / notification. */
export type IslandPlacement = Corner | "hidden";

export type Point = { x: number; y: number };

export type Edge = "left" | "right" | "top" | "bottom";

/** Where the orb rests: an edge of the screen and how far along it (0 = start, 1 = end). */
export type OrbDock = { edge: Edge; offset: number };

/** How an image is letterboxed inside its container, in screen points. */
export type FitGeometry = Rect & { scale: number };
