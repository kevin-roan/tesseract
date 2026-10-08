export type IslandRunState = "running" | "completed" | "failed" | "cancelled";

export type IslandRun = {
  id: string;
  title: string;
  project: string | null;
  state: IslandRunState;
  startedAt: string;
  tokens: number | null;
};

export type IslandCommand = {
  id: string;
  label: string;
  project: string | null;
  state: string;
};

export type IslandUsage = {
  todayTokens: number;
  weekTokens: number;
  runsToday: number;
  messagesToday: number;
};

/** Everything the Live Activity (iOS) or ongoing notification (Android) renders. */
export type IslandState = {
  sandboxId: string;
  sandboxName: string;
  runs: IslandRun[];
  commands: IslandCommand[];
  usage: IslandUsage;
  updatedAt: string;
};

export type IslandActionKind = "stop" | "capture" | "open" | "share";

/** A button tap on the island, notification or share sheet that the app has to handle. */
export type IslandAction = {
  action: IslandActionKind;
  runId?: string;
};

export type IslandTokenKind = "activity" | "push-to-start";

export type IslandPushToken = {
  kind: IslandTokenKind;
  token: string;
  activityId: string | null;
};

export type SharedItemKind = "image" | "text" | "url" | "file";

/** One thing handed to the app by the share extension (iOS) or a share intent (Android). */
export type SharedItem = {
  id: string;
  kind: SharedItemKind;
  uri: string | null;
  text: string | null;
  name: string;
  mimeType: string;
  sizeBytes: number | null;
  createdAt: string;
};

export type CapturedImage = {
  uri: string;
  width: number;
  height: number;
};

/** Rectangle in image pixels. */
export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TextBlock = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RecognizedText = {
  text: string;
  blocks: TextBlock[];
};

export type ScreenCaptureSource = "app" | "screen";

export type IslandEvents = {
  onIslandAction: (event: IslandAction) => void;
  onPushToken: (event: IslandPushToken) => void;
  onSharedItems: (event: { count: number }) => void;
};
