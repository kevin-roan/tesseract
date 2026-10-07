import type {
  AndroidDevice,
  AndroidLinkInfo,
  AndroidStreamSettings,
  EmulatorInfo,
  HostAndroidStatus,
  LinkSandbox,
  StartEmulator,
  UpdateAndroidStream,
} from "@theone/protocol";
import { watch, type FSWatcher } from "node:fs";
import { errorMessage } from "../../core/errors";
import type { Logger } from "../../core/logger";
import type { HostStateStore } from "../state";
import type { AndroidConfig } from "./config";
import { listAdbDevices } from "./devices";
import { EmulatorManager, type EmulatorOptions } from "./emulator";
import { AndroidLink, type LinkOptions } from "./link";
import { AndroidScreens, type ScreenOptions } from "./screen";

export type HostAndroidOptions = { emulator?: EmulatorOptions; link?: LinkOptions; screen?: ScreenOptions; settingsDebounceMs?: number };

const SETTINGS_DEBOUNCE_MS = 150;

/** The host's Android emulator, the screen stream of any adb device and the sandbox link, behind `/v1/android`. */
export class HostAndroid {
  readonly emulator: EmulatorManager;
  readonly link: AndroidLink;
  readonly screens: AndroidScreens;
  private readonly unsubscribe: () => void;
  private readonly settingsDebounceMs: number;
  private streamKey: string;
  private watcher: FSWatcher | null = null;
  private watchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly config: AndroidConfig,
    private readonly store: HostStateStore,
    identity: { hostId: string; version: string },
    private readonly logger: Logger,
    options: HostAndroidOptions = {},
  ) {
    this.settingsDebounceMs = options.settingsDebounceMs ?? SETTINGS_DEBOUNCE_MS;
    this.streamKey = JSON.stringify(store.androidStreamSettings());
    this.emulator = new EmulatorManager(config, logger, options.emulator);
    this.screens = new AndroidScreens(config, this.emulator, logger, { settings: () => store.androidStreamSettings(), ...options.screen });
    this.link = new AndroidLink(
      {
        ...identity,
        emulator: () => this.emulator.current(),
        adbd: () => this.emulator.adbdEndpoint(),
        refusal: () => this.emulator.linkRefusal(),
      },
      logger,
      options.link,
    );
    this.unsubscribe = this.emulator.onChange((info) => this.link.emulatorChanged(info));
  }

  /** Adopts a running emulator, then dials the stored link and follows stream settings saved by `host stream`. */
  async init(): Promise<void> {
    this.watchSettings();
    await this.emulator.init();
    const stored = this.store.read().androidLink;
    if (stored) this.link.configure(stored);
  }

  async status(): Promise<HostAndroidStatus> {
    const reason = this.emulator.unavailableReason();
    const [avds, devices] = await Promise.all([this.emulator.listAvds(), this.devices()]);
    return {
      available: reason === null,
      reason,
      sdkRoot: this.config.sdkRoot,
      isolation: this.config.isolation,
      avds,
      scrcpy: this.config.scrcpyServer !== null && this.config.scrcpyVersion !== null,
      ffmpeg: this.config.ffmpeg !== null,
      emulator: this.emulator.current(),
      link: this.link.info(),
      stream: this.store.androidStreamSettings(),
      devices,
    };
  }

  devices(): Promise<AndroidDevice[]> {
    return listAdbDevices(this.config, this.emulator.serial);
  }

  streamSettings(): AndroidStreamSettings {
    return this.store.androidStreamSettings();
  }

  /** Open screens move to a session with the new settings. */
  updateStream(change: UpdateAndroidStream): AndroidStreamSettings {
    const settings = this.store.updateAndroidStream(change);
    this.streamChanged();
    return settings;
  }

  /** `state.json` is replaced by a rename, so the directory is watched. */
  private watchSettings(): void {
    try {
      this.watcher = watch(this.store.dir, () => {
        if (this.watchTimer) clearTimeout(this.watchTimer);
        this.watchTimer = setTimeout(() => this.streamChanged(), this.settingsDebounceMs);
      });
    } catch (error) {
      this.logger.warn("cannot watch the host state; stream settings saved by the CLI apply to new screens only", { error: errorMessage(error) });
    }
  }

  private streamChanged(): void {
    let key: string;
    try {
      key = JSON.stringify(this.store.androidStreamSettings());
    } catch {
      return;
    }
    if (key === this.streamKey) return;
    this.streamKey = key;
    this.screens.restart();
  }

  start(input: StartEmulator): Promise<EmulatorInfo> {
    return this.emulator.start(input);
  }

  stop(): EmulatorInfo {
    return this.emulator.stop();
  }

  linkSandbox(input: LinkSandbox): AndroidLinkInfo {
    const link = { sandboxUrl: input.sandboxUrl.replace(/\/+$/, ""), token: input.token };
    this.store.setAndroidLink(link);
    this.link.configure(link);
    return this.link.info();
  }

  unlinkSandbox(): AndroidLinkInfo {
    this.store.setAndroidLink(null);
    this.link.configure(null);
    return this.link.info();
  }

  async shutdown(): Promise<void> {
    this.unsubscribe();
    this.watcher?.close();
    if (this.watchTimer) clearTimeout(this.watchTimer);
    this.link.shutdown();
    await this.screens.shutdown();
    await this.emulator.shutdown();
  }
}
