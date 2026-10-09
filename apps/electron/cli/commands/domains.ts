import type { CloudflareZone, DomainRoute } from "../../src/shared/contracts/containers";
import { positiveInt } from "../args";
import { containersService, readStdinSecret } from "../containers-service";
import { table } from "../format";
import { emit, guarded, log, usageError } from "../io";
import { CLI_LABELS } from "../labels";
import { defineCommand, EXIT, type CliContext } from "../types";
import { describeReport } from "./containers";

const LABELS = CLI_LABELS.domains;

export function describeRoutes(routes: readonly DomainRoute[]): string[] {
  if (!routes.length) return [LABELS.none];
  return table([
    LABELS.header,
    ...routes.map((route) => [`https://${route.hostname}`, `${route.container}:${route.port}`, route.scheme, route.error ? `${route.status}: ${route.error}` : route.status]),
  ]);
}

function describeZones(zones: readonly CloudflareZone[]): string[] {
  return zones.length ? zones.map((zone) => zone.name) : [LABELS.noZones];
}

type Action = (context: CliContext) => Promise<number>;

export const DOMAINS_ACTIONS: Record<string, Action> = {
  ls: async (context) => {
    emit(context, await containersService(context).routes(), describeRoutes);
    return EXIT.ok;
  },
  zones: async (context) => {
    emit(context, (await containersService(context).report()).cloudflare.zones, describeZones);
    return EXIT.ok;
  },
  add: async (context) => {
    const [, hostname, container, portText] = context.args;
    const port = positiveInt(portText);
    if (!hostname || !container || !port) usageError(LABELS.addUsage);
    log(context, LABELS.adding(hostname, container, port));
    const route = await containersService(context).addRoute({ hostname, container, port, scheme: context.flags.has("https") ? "https" : "http" });
    emit(context, route, (value) => [LABELS.added(value.hostname)]);
    return EXIT.ok;
  },
  rm: async (context) => {
    const target = context.args[1];
    if (!target) usageError(CLI_LABELS.missingArgument("domains", LABELS.hostnameArg));
    const service = containersService(context);
    const route = (await service.routes()).find((entry) => entry.id === target || entry.hostname === target.toLowerCase());
    if (!route) usageError(LABELS.notFound(target));
    await service.removeRoute(route.id);
    emit(context, { removed: route.hostname }, () => [LABELS.removed(route.hostname)]);
    return EXIT.ok;
  },
  sync: async (context) => {
    emit(context, await containersService(context).syncRoutes(), describeRoutes);
    return EXIT.ok;
  },
  login: async (context) => {
    const token = await readStdinSecret();
    if (!token) usageError(LABELS.tokenFromStdin);
    emit(context, await containersService(context).setCloudflareToken(token), describeReport);
    return EXIT.ok;
  },
  logout: async (context) => {
    emit(context, await containersService(context).setCloudflareToken(null), describeReport);
    return EXIT.ok;
  },
};

export default defineCommand({
  name: "domains",
  trigger: { subcommand: "domains" },
  summary: CLI_LABELS.summary.domains,
  usage: CLI_LABELS.usageLines.domains,
  flags: ["https"],
  run: (context) =>
    guarded(context, async () => {
      const name = context.args[0] ?? "ls";
      const action = DOMAINS_ACTIONS[name];
      if (!action) usageError(CLI_LABELS.unknownSubcommand("domains", name));
      return action(context);
    }),
});
