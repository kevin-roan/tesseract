import {
  CGNAT_FIRST_OCTET,
  CGNAT_SECOND_OCTET_MAX,
  CGNAT_SECOND_OCTET_MIN,
  DEFAULT_PORTS,
  LOOPBACK_SCHEMES,
  TAILNET_LOOPBACK_HOST,
} from "./constants";

const URL_PATTERN = /^([a-z][a-z0-9+.-]*):\/\/(?:[^@/?#]*@)?([^:/?#]+)(?::(\d+))?([/?#].*)?$/i;
const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export type TailnetTarget = {
  scheme: string;
  host: string;
  port: number;
  rest: string;
};

export function normalizeSuffix(suffix: string | null | undefined): string | null {
  const trimmed = suffix?.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  return trimmed ? trimmed : null;
}

export function isCgnatAddress(host: string): boolean {
  const match = IPV4_PATTERN.exec(host);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((octet) => octet > 255)) return false;
  return octets[0] === CGNAT_FIRST_OCTET && octets[1] >= CGNAT_SECOND_OCTET_MIN && octets[1] <= CGNAT_SECOND_OCTET_MAX;
}

export function isTailnetHost(host: string, suffix: string | null): boolean {
  const name = host.toLowerCase().replace(/\.$/, "");
  if (isCgnatAddress(name)) return true;
  const normalized = normalizeSuffix(suffix);
  return normalized !== null && name.endsWith(`.${normalized}`);
}

export function tailnetTargetOf(url: string, suffix: string | null): TailnetTarget | null {
  const match = URL_PATTERN.exec(url.trim());
  if (!match) return null;
  const scheme = match[1].toLowerCase();
  const host = match[2].toLowerCase().replace(/\.$/, "");
  const port = match[3] ? Number(match[3]) : DEFAULT_PORTS[scheme];
  if (!LOOPBACK_SCHEMES[scheme] || !port || !isTailnetHost(host, suffix)) return null;
  return { scheme, host, port, rest: match[4] ?? "" };
}

export function forwardKey(target: Pick<TailnetTarget, "host" | "port">): string {
  return `${target.host}:${target.port}`;
}

export function loopbackUrl(target: TailnetTarget, localPort: number): string {
  return `${LOOPBACK_SCHEMES[target.scheme]}://${TAILNET_LOOPBACK_HOST}:${localPort}${target.rest}`;
}
