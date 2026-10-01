const preset = { extension: ".m4a", sampleRate: 44100, numberOfChannels: 2, bitRate: 128000 };

export const RecordingPresets = { HIGH_QUALITY: preset, LOW_QUALITY: preset };

const recorderStatus = {
  canRecord: true,
  isRecording: false,
  durationMillis: 0,
  mediaServicesDidReset: false,
  metering: -20 as number | undefined,
  url: null as string | null,
};

export const recorder = {
  uri: "file:///cache/recording.m4a" as string | null,
  prepareToRecordAsync: jest.fn(async () => undefined),
  record: jest.fn(),
  stop: jest.fn(async () => undefined),
  getStatus: jest.fn(() => ({ ...recorderStatus })),
};

const playerStatus = {
  id: "player",
  currentTime: 0,
  duration: 0,
  playing: false,
  didJustFinish: false,
  isBuffering: false,
  isLoaded: false,
  playbackState: "idle",
  timeControlStatus: "paused",
  reasonForWaitingToPlay: "",
  mute: false,
  loop: false,
  playbackRate: 1,
};

export const player = {
  play: jest.fn(),
  pause: jest.fn(),
  replace: jest.fn(),
  seekTo: jest.fn(async () => undefined),
};

export const requestRecordingPermissionsAsync = jest.fn(async () => ({ granted: true, status: "granted", canAskAgain: true, expires: "never" }));
export const setAudioModeAsync = jest.fn(async () => undefined);
export const useAudioRecorder = jest.fn(() => recorder);
export const useAudioRecorderState = jest.fn(() => ({ ...recorderStatus }));
export const useAudioPlayer = jest.fn(() => player);
export const useAudioPlayerStatus = jest.fn(() => ({ ...playerStatus }));

export function __setRecorderStatus(next: Partial<typeof recorderStatus>): void {
  Object.assign(recorderStatus, next);
}

export function __setPlayerStatus(next: Partial<typeof playerStatus>): void {
  Object.assign(playerStatus, next);
}

export function __reset(): void {
  Object.assign(recorderStatus, { isRecording: false, durationMillis: 0, metering: -20 });
  Object.assign(playerStatus, { currentTime: 0, duration: 0, playing: false, didJustFinish: false, isBuffering: false });
  recorder.uri = "file:///cache/recording.m4a";
  [recorder.prepareToRecordAsync, recorder.record, recorder.stop, recorder.getStatus].forEach((fn) => fn.mockClear());
  [player.play, player.pause, player.replace, player.seekTo].forEach((fn) => fn.mockClear());
  requestRecordingPermissionsAsync.mockClear();
  setAudioModeAsync.mockClear();
}
