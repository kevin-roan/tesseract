import { tmpdir } from "node:os";
import {
  isExpoGoUrl,
  type BootSimulator,
  type HostIosStatus,
  type IosInstallRequest,
  type IosLinkInfo,
  type LinkSandbox,
  type SimDevice,
  type StopSignal,
} from "@tesseract/protocol";
import { conflict, unavailable } from "../../core/errors";
import type { Logger } from "../../core/logger";
import type { HostStateStore } from "../state";
import type { IosConfig } from "./config";
import { ensureExpoGo } from "./expo-go";
import { IosInstalls, type InstallsOptions } from "./installs";
import { IosLink, type IosLinkOptions } from "./link";
import { defaultRunner, type CommandRunner, type ProcessSpawner } from "./runner";
import { IOS_SCREEN_MESSAGES, IosScreens, type IosScreenOptions } from "./screen";
import type { ScreenGeometry } from "./simctl";
import { IosSimulators, SIMULATOR_MESSAGES, type SimulatorOptions } from "./simulator";

export type HostIosOptions = {
  runner?: CommandRunner;
  spawner?: ProcessSpawner;
  fetcher?: typeof fetch;
  tmpDir?: () => string;
  simulator?: Omit<SimulatorOptions, "runner" | "geometry">;
  screen?: Omit<IosScreenOptions, "runner" | "spawner">;
  link?: IosLinkOptions;
  installs?: InstallsOptions;
};

const KILL_GRACE_MS = 0;

/** The host's iOS Simulator behind `/v1/ios`: devices, the screen stream, the sandbox link and installs. */
export class HostIos {
  readonly simulators: IosSimulators;
  readonly screens: IosScreens;
  readonly link: IosLink;
  readonly installs: IosInstalls;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly config: IosConfig,
    private readonly store: HostStateStore,
    identity: { hostId: string; version: string },
    private readonly logger: Logger,
    options: HostIosOptions = {},
  ) {
    const runner = options.runner ?? defaultRunner;
    const tmpDir = options.tmpDir ?? tmpdir;
    this.simulators = new IosSimulators(config, logger, { ...options.simulator, runner, geometry: (udid) => this.geometry(udid) });
    this.screens = new IosScreens(
      config,
      { target: (udid) => this.simulators.target(udid), unavailableReason: () => this.simulators.unavailableReason() },
      logger,
      { runner, spawner: options.spawner, ...options.screen },
    );
    const simctl = this.simulators.simctl;
    this.installs = new IosInstalls(
      config,
      runner,
      simctl,
      { approved: () => store.read().iosApprovedBundles, approve: (sha256) => store.approveIosBundle(sha256) },
      tmpDir,
      logger,
      options.installs,
    );
    this.link = new IosLink(
      {
        ...identity,
        simulator: async () => {
          const available = (await this.simulators.availability()).available;
          return { available, booted: available ? await this.simulators.target() : null };
        },
        openUrl: async (url, sdkVersion, progress) => {
          const device = await this.bootedOrFail();
          if (isExpoGoUrl(url)) await ensureExpoGo({ config, runner, simctl, tmpDir, logger, fetcher: options.fetcher }, device.udid, sdkVersion, progress);
          progress("opening");
          await simctl.openUrl(device.udid, url);
        },
        install: async (api, artifactId, progress) => this.installs.install(api, artifactId, (await this.bootedOrFail()).udid, progress),
      },
      logger,
      options.link,
    );
    this.unsubscribe = this.simulators.onChange((booted) => {
      void this.simulators.availability().then(({ available }) => this.link.simulatorChanged(available, booted?.state === "booted" ? booted : null));
    });
  }

  private geometry(udid: string): ScreenGeometry | null {
    return this.screens.sessionFor(udid)?.geometry?.() ?? null;
  }

  private async bootedOrFail(): Promise<SimDevice> {
    const reason = await this.simulators.unavailableReason();
    if (reason) throw unavailable(reason);
    const device = await this.simulators.target();
    if (!device) throw conflict(SIMULATOR_MESSAGES.noneBooted);
    return device;
  }

  /** Dials the stored link (only when iOS support is on) and starts watching the booted device. */
  async init(): Promise<void> {
    if (!this.config.enabled) return;
    this.simulators.start();
    const stored = this.store.read().iosLink;
    if (stored) this.link.configure(stored);
  }

  async status(): Promise<HostIosStatus> {
    const availability = await this.simulators.availability();
    const devices = availability.available ? await this.simulators.list() : [];
    return {
      available: availability.available,
      reason: availability.reason,
      reasonCode: availability.reasonCode,
      xcode: availability.xcode,
      idb: this.config.idb !== null && this.config.idbCompanion !== null,
      isolation: "none",
      devices,
      booted: this.simulators.booted(devices),
      link: this.link.info(),
      tunnels: this.link.tunnelInfo(),
      installs: this.installs.list(),
    };
  }

  boot(input: BootSimulator): Promise<SimDevice> {
    return this.simulators.boot(input.udid);
  }

  /** `SIGKILL`: screen sessions and tunnel connections are dropped at once, then the device's processes are killed. */
  shutdownSimulator(signal?: StopSignal): Promise<SimDevice> {
    return this.simulators.shutdown(signal, async (udid, kill) => {
      if (kill) this.link.dropStreams();
      await this.screens.end(udid, IOS_SCREEN_MESSAGES.shutdown, kill ? KILL_GRACE_MS : undefined);
    });
  }

  async linkSandbox(input: LinkSandbox): Promise<IosLinkInfo> {
    await this.requireEnabled();
    const link = { sandboxUrl: input.sandboxUrl.replace(/\/+$/, ""), token: input.token };
    this.store.setIosLink(link);
    this.link.configure(link);
    return this.link.info();
  }

  unlinkSandbox(): IosLinkInfo {
    this.store.setIosLink(null);
    this.link.configure(null);
    return this.link.info();
  }

  listInstalls(): IosInstallRequest[] {
    return this.installs.list();
  }

  decideInstall(id: string, approve: boolean): IosInstallRequest {
    return this.installs.decide(id, approve);
  }

  private async requireEnabled(): Promise<void> {
    const availability = await this.simulators.availability();
    if (availability.reasonCode === "disabled" || availability.reasonCode === "not_macos") throw unavailable(availability.reason ?? SIMULATOR_MESSAGES.disabled);
  }

  async shutdown(): Promise<void> {
    this.unsubscribe();
    this.simulators.stop();
    this.installs.shutdown();
    await this.link.shutdown();
    await this.screens.shutdown();
  }
}
