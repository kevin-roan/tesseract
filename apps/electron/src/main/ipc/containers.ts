import { join } from "node:path";
import { shouldSealTokens } from "../../core/connection";
import { ContainersService, stateFileIn } from "../../core/containers";
import { effectiveEnv } from "../../core/docker";
import { LogRing } from "../../core/log";
import { CONFIG_FILE_NAME, stateDir } from "../../core/paths";
import { runCommand } from "../../core/process";
import { streamCommand } from "../../core/sandbox/spawn";
import { mainContext } from "../context";
import { sandboxContextDir } from "../services/resources";
import { tokenCipher } from "../services/token-cipher";
import { defineService } from "./_framework/define";
import { serviceEmitter } from "./_framework/events";

const events = serviceEmitter("containers");
const log = new LogRing();
let instance: ContainersService | null = null;

function pushLog(line: string): void {
  log.push(line).forEach((entry) => events.emit("log", entry));
}

export function containersService(): ContainersService {
  if (instance) return instance;
  const context = mainContext();
  const seal = shouldSealTokens({
    platform: process.platform,
    env: process.env,
    configFile: context.configFile,
    defaultConfigFile: join(context.paths.userData ?? "", CONFIG_FILE_NAME),
    test: context.isTest || context.fixtures,
    cipher: tokenCipher,
  });
  instance = new ContainersService({
    docker: {
      run: (file, args, options = {}) =>
        runCommand(file, args, { timeoutMs: options.timeoutMs, input: options.input, env: { ...effectiveEnv(), ...options.extraEnv } }),
      stream: (file, args, options = {}) => streamCommand(file, args, { ...options, env: effectiveEnv() }),
      log: pushLog,
    },
    configFile: context.configFile,
    stateFile: stateFileIn(stateDir(context.paths)),
    contextDir: sandboxContextDir(),
    env: process.env,
    cipher: tokenCipher,
    seal,
    onContainers: (containers) => events.emit("containers", containers),
    onRoutes: (routes) => events.emit("routes", routes),
    onPhase: (phase) => events.emit("phase", phase),
  });
  return instance;
}

export default defineService("containers", {
  report: () => containersService().report(),
  list: () => containersService().list(),
  create: (_context, request) => containersService().create(request),
  start: (_context, name) => containersService().start(name),
  stop: (_context, name) => containersService().stop(name),
  restart: (_context, name) => containersService().restart(name),
  remove: (_context, name) => containersService().remove(name),
  logs: (_context, name) => containersService().logs(name),
  buildImage: () => containersService().buildImage(),
  cancel: () => containersService().cancel(),
  phase: () => containersService().phase(),
  setTailscaleKey: (_context, request) => containersService().setTailscaleKey(request),
  setCloudflareToken: (_context, token) => containersService().setCloudflareToken(token),
  routes: () => containersService().routes(),
  addRoute: (_context, request) => containersService().addRoute(request),
  removeRoute: (_context, id) => containersService().removeRoute(id),
  syncRoutes: () => containersService().syncRoutes(),
});
