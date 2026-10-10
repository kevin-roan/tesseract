import type { CheckItem } from "../../src/shared/contracts/common";
import { CLI_LABELS } from "../labels";

const LABELS = CLI_LABELS.tailnet;

export interface TailnetNode {
  state: string;
  tailnet: string;
  suffix: string;
  dnsName: string;
  hostName: string;
  ip: string;
  online: boolean | null;
  keyExpiry: string | null;
  certDomains: string[];
  health: string[];
  authUrl: string;
}

export interface TailnetPeer {
  dnsName: string;
  ip: string;
  online: boolean;
  lastSeen: string;
}

export interface ServeProxy {
  front: string;
  target: string;
}

export interface TailnetFacts {
  mode: string;
  configuredMode: string;
  hostname: string;
  envDomain: string | null;
  authKeySaved: boolean;
  tailscaleCli: boolean;
  host: TailnetNode | null;
  sidecarContainer: string | null;
  sidecar: TailnetNode | null;
  sidecarLogErrors: string[];
  volume: string;
  volumeCreated: string | null;
  publicUrl: string | null;
  peerVisible: boolean | null;
  otherPeers: TailnetPeer[];
  ping: { ok: boolean; detail: string } | null;
  controllerUp: boolean | null;
  sidecarServesController: boolean | null;
  httpsCode: string | null;
  resolvedIp: string | null;
  hostServe: ServeProxy[];
  hostShellPort: number;
  hostShellAnswers: boolean | null;
  restartHostShell: string;
}

const AUTH_ERROR = /invalid key|key expired|not valid|unauthorized|node not found|logged out|machine.*not authorized|requires.*approval|backend error|auth.*fail/i;
const ZERO_TIME = "0001-";

interface RawStatus {
  BackendState?: string;
  AuthURL?: string;
  TailscaleIPs?: string[];
  MagicDNSSuffix?: string;
  CurrentTailnet?: { Name?: string; MagicDNSSuffix?: string } | null;
  CertDomains?: string[] | null;
  Health?: string[] | null;
  Self?: RawPeer | null;
  Peer?: Record<string, RawPeer> | null;
}

interface RawPeer {
  HostName?: string;
  DNSName?: string;
  TailscaleIPs?: string[] | null;
  Online?: boolean;
  KeyExpiry?: string;
  LastSeen?: string;
}

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

const ipv4 = (ips: readonly string[] | null | undefined) => ips?.find((ip) => !ip.includes(":")) ?? "";
const trimDot = (name: string | undefined) => (name ?? "").replace(/\.$/, "");

export function parseStatus(text: string): TailnetNode | null {
  const data = parseJson<RawStatus>(text);
  if (!data?.BackendState) return null;
  const self = data.Self ?? {};
  const expiry = self.KeyExpiry && !self.KeyExpiry.startsWith(ZERO_TIME) ? self.KeyExpiry : null;
  return {
    state: data.BackendState,
    tailnet: data.CurrentTailnet?.Name ?? "",
    suffix: data.CurrentTailnet?.MagicDNSSuffix || data.MagicDNSSuffix || "",
    dnsName: trimDot(self.DNSName),
    hostName: self.HostName ?? "",
    ip: ipv4(data.TailscaleIPs) || ipv4(self.TailscaleIPs),
    online: typeof self.Online === "boolean" ? self.Online : null,
    keyExpiry: expiry,
    certDomains: data.CertDomains ?? [],
    health: data.Health ?? [],
    authUrl: data.AuthURL ?? "",
  };
}

/** Whether `ip` is among the host's peers, and other peers that look like old copies of `hostname`. */
export function findPeers(text: string, hostname: string, ip: string): { visible: boolean; others: TailnetPeer[] } {
  const peers = Object.values(parseJson<RawStatus>(text)?.Peer ?? {});
  const visible = peers.some((peer) => peer.TailscaleIPs?.includes(ip));
  const others = peers
    .filter((peer) => !peer.TailscaleIPs?.includes(ip))
    .filter((peer) => peer.HostName === hostname || trimDot(peer.DNSName).split(".")[0]?.startsWith(hostname))
    .map((peer) => ({ dnsName: trimDot(peer.DNSName) || (peer.HostName ?? ""), ip: ipv4(peer.TailscaleIPs), online: Boolean(peer.Online), lastSeen: peer.LastSeen ?? "" }));
  return { visible, others };
}

export function parseServe(text: string): ServeProxy[] {
  const web = parseJson<{ Web?: Record<string, { Handlers?: Record<string, { Proxy?: string }> }> }>(text)?.Web ?? {};
  return Object.entries(web).flatMap(([front, entry]) =>
    Object.entries(entry.Handlers ?? {}).flatMap(([path, handler]) => (handler.Proxy ? [{ front: `${front}${path}`, target: handler.Proxy }] : [])),
  );
}

export function authErrors(logs: string, limit = 5): string[] {
  return logs.split(/\r?\n/).filter((line) => AUTH_ERROR.test(line)).slice(-limit).map((line) => line.slice(0, 200));
}

const targetIp = (target: string) => target.replace(/^https?:\/\//, "").replace(/[:/].*$/, "");

function check(id: string, status: CheckItem["status"], title: string, detail = ""): CheckItem {
  return { id, status, title, detail };
}

function hostChecks(facts: TailnetFacts): CheckItem[] {
  if (!facts.tailscaleCli) return [check("host", "warning", LABELS.noCli, LABELS.noCliFix)];
  const host = facts.host;
  if (host?.state !== "Running") return [check("host", "error", LABELS.hostDown(host?.state ?? LABELS.unknown), LABELS.hostDownFix)];
  const items = [check("host", "ok", LABELS.host, LABELS.node(host.dnsName, host.ip, host.suffix))];
  if (host.health.length > 0) items.push(check("host-health", "warning", LABELS.hostHealth, host.health.join("\n")));
  return items;
}

function sidecarChecks(facts: TailnetFacts): CheckItem[] {
  if (!facts.sidecarContainer) return [check("sidecar", "error", LABELS.noSidecar, LABELS.noSidecarFix)];
  const node = facts.sidecar;
  const items: CheckItem[] = [];
  switch (node?.state) {
    case "Running":
      items.push(check("sidecar", "ok", LABELS.sidecar, LABELS.node(node.dnsName, node.ip, node.suffix)));
      break;
    case "NeedsLogin":
      items.push(check("sidecar", "error", LABELS.loggedOut, LABELS.loggedOutFix));
      break;
    case "NeedsMachineAuth":
      items.push(check("sidecar", "error", LABELS.needsApproval, LABELS.needsApprovalFix(node.hostName || facts.hostname)));
      break;
    default:
      items.push(check("sidecar", "error", LABELS.sidecarDown(node?.state ?? LABELS.unknown), LABELS.loggedOutFix));
  }
  if (node?.authUrl) items.push(check("auth-url", "warning", LABELS.wantsLogin, node.authUrl));
  if (node?.state === "Running" && node.certDomains.length === 0) {
    items.push(check("https", "error", LABELS.noHttps, LABELS.noHttpsFix(node.suffix)));
  }
  if (node?.keyExpiry) items.push(check("expiry", "ok", LABELS.keyExpiry, LABELS.keyExpiryDetail(node.keyExpiry)));
  if (node?.health.length) items.push(check("sidecar-health", "warning", LABELS.sidecarHealth, node.health.join("\n")));
  if (facts.sidecarLogErrors.length > 0) items.push(check("logs", "warning", LABELS.logErrors, facts.sidecarLogErrors.join("\n")));
  return items;
}

function agreementChecks(facts: TailnetFacts): CheckItem[] {
  const { host, sidecar } = facts;
  const items: CheckItem[] = [];
  if (host?.suffix && sidecar?.suffix) {
    items.push(
      host.suffix === sidecar.suffix
        ? check("same-tailnet", "ok", LABELS.sameTailnet(host.suffix))
        : check("same-tailnet", "error", LABELS.splitTailnet(host.suffix, sidecar.suffix), LABELS.splitTailnetFix(host.suffix)),
    );
  }
  if (sidecar?.suffix && facts.envDomain && facts.envDomain !== sidecar.suffix) {
    items.push(check("domain", "error", LABELS.staleDomain(facts.envDomain, sidecar.suffix), LABELS.staleDomainFix(sidecar.suffix)));
  }
  if (sidecar?.dnsName && facts.publicUrl && facts.publicUrl !== `https://${sidecar.dnsName}`) {
    const renamed = sidecar.dnsName.split(".")[0] !== facts.hostname;
    items.push(
      check(
        "url",
        "error",
        LABELS.staleUrl(facts.publicUrl, `https://${sidecar.dnsName}`),
        renamed ? LABELS.renamedFix(facts.hostname) : LABELS.staleUrlFix,
      ),
    );
  } else if (sidecar?.dnsName && facts.publicUrl) {
    items.push(check("url", "ok", LABELS.urlMatches, facts.publicUrl));
  }
  if (facts.authKeySaved && sidecar?.state === "Running") {
    items.push(check("key", "error", LABELS.keyIgnored(facts.volume), LABELS.keyIgnoredFix));
  } else {
    items.push(check("key", "ok", LABELS.identity(facts.volume), LABELS.identityDetail(facts.volumeCreated)));
  }
  return items;
}

function reachChecks(facts: TailnetFacts): CheckItem[] {
  const sidecar = facts.sidecar;
  const items: CheckItem[] = [];
  if (facts.peerVisible === false) items.push(check("peer", "error", LABELS.peerMissing(sidecar?.ip ?? ""), LABELS.peerMissingFix));
  if (facts.peerVisible) items.push(check("peer", "ok", LABELS.peerVisible));
  if (facts.otherPeers.length > 0) {
    const lines = facts.otherPeers.map((peer) => LABELS.peerLine(peer.dnsName, peer.ip, peer.online, peer.lastSeen));
    items.push(check("stale", "warning", LABELS.stalePeers, [...lines, LABELS.stalePeersFix].join("\n")));
  }
  if (facts.ping) {
    items.push(facts.ping.ok ? check("ping", "ok", LABELS.ping, facts.ping.detail) : check("ping", "error", LABELS.pingFailed, `${facts.ping.detail}\n${LABELS.pingFix}`));
  }
  if (facts.controllerUp === false) items.push(check("controller", "error", LABELS.controllerDown, LABELS.controllerDownFix));
  if (facts.controllerUp) items.push(check("controller", "ok", LABELS.controllerUp));
  if (facts.sidecarServesController === false && sidecar?.state === "Running") {
    items.push(check("serve", "error", LABELS.noServe, LABELS.noServeFix(facts.sidecarContainer ?? "")));
  }
  if (facts.httpsCode !== null && sidecar?.dnsName) {
    const url = `https://${sidecar.dnsName}/v1/health`;
    items.push(facts.httpsCode === "200" ? check("health", "ok", LABELS.healthOk, url) : check("health", "error", LABELS.healthFailed(facts.httpsCode), url));
  }
  if (sidecar?.ip && facts.resolvedIp !== null && facts.resolvedIp !== sidecar.ip) {
    items.push(check("dns", "warning", LABELS.dnsMismatch(sidecar.dnsName, facts.resolvedIp || LABELS.nothing, sidecar.ip), LABELS.dnsFix));
  }
  return items;
}

function hostShellChecks(facts: TailnetFacts): CheckItem[] {
  const hostIp = facts.host?.ip;
  return facts.hostServe.flatMap((proxy): CheckItem[] => {
    const ip = targetIp(proxy.target);
    if (hostIp && ip.startsWith("100.") && ip !== hostIp) {
      return [check("host-shell", "error", LABELS.staleServe(proxy.front, proxy.target, hostIp), LABELS.staleServeFix(facts.restartHostShell))];
    }
    if (!proxy.target.includes(`:${facts.hostShellPort}`)) return [];
    return facts.hostShellAnswers === false
      ? [check("host-shell", "error", LABELS.hostShellDown(proxy.target), LABELS.hostShellDownFix(facts.restartHostShell))]
      : [check("host-shell", "ok", LABELS.hostShell, `https://${proxy.front} → ${proxy.target}`)];
  });
}

export function analyzeTailnet(facts: TailnetFacts): CheckItem[] {
  if (facts.mode !== "tailscale") {
    return [...hostChecks(facts), check("mode", "ok", LABELS.otherMode(facts.mode)), ...hostShellChecks(facts)];
  }
  const drift = facts.configuredMode !== facts.mode ? [check("mode", "warning", LABELS.modeDrift(facts.configuredMode), LABELS.modeDriftFix)] : [];
  return [...hostChecks(facts), ...drift, ...sidecarChecks(facts), ...agreementChecks(facts), ...reachChecks(facts), ...hostShellChecks(facts)];
}
