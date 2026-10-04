import type { AndroidLinkInfo, EmulatorInfo, HostAndroidStatus, LinkSandbox, StartEmulator } from "@theone/protocol";
import type { Logger } from "../../core/logger";
import type { HostStateStore } from "../state";
import type { AndroidConfig } from "./config";
import { EmulatorManager, type EmulatorOptions } from "./emulator";
import { AndroidLink, type LinkOptions } from "./link";
import { AndroidScreens, type ScreenOptions } from "./screen";

export type HostAndroidOptions = { emulator?: EmulatorOptions; link?: LinkOptions; screen?: ScreenOptions };

/** The host's Android emulator, its screen stream and the sandbox link, behind `/v1/android`. */
export class HostAndroid {
  readonly emulator: EmulatorManager;
  readonly link: AndroidLink;
  readonly screens: AndroidScreens;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly config: AndroidConfig,
    private readonly store: HostStateStore,
    identity: { hostId: string; version: string },
    logger: Logger,
    options: HostAndroidOptions = {},
  ) {
    this.emulator = new EmulatorManager(config, logger, options.emulator);
    this.screens = new AndroidScreens(config, this.emulator, logger, options.screen);
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

  /** Adopts a running emulator, then dials the stored link. */
  async init(): Promise<void> {
    await this.emulator.init();
    const stored = this.store.read().androidLink;
    if (stored) this.link.configure(stored);
  }

  async status(): Promise<HostAndroidStatus> {
    const reason = this.emulator.unavailableReason();
    return {
      available: reason === null,
      reason,
      sdkRoot: this.config.sdkRoot,
      isolation: this.config.isolation,
      avds: await this.emulator.listAvds(),
      scrcpy: this.config.scrcpyServer !== null && this.config.scrcpyVersion !== null,
      ffmpeg: this.config.ffmpeg !== null,
      emulator: this.emulator.current(),
      link: this.link.info(),
    };
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
    this.link.shutdown();
    await this.screens.shutdown();
    await this.emulator.shutdown();
  }
}
