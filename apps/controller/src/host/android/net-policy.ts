export type IpAddress = { family: 4 | 6; value: bigint };
export type Cidr = { family: 4 | 6; network: bigint; prefix: number };

const V4_BITS = 32;
const V6_BITS = 128;
const V4_OCTET = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const V6_GROUP = /^[0-9a-f]{1,4}$/i;
const MAPPED_V4 = { family: 6, network: 0xffffn << 32n, prefix: 96 } as const satisfies Cidr;

function parseIpv4(text: string): bigint | null {
  const parts = text.split(".");
  if (parts.length !== 4 || !parts.every((part) => V4_OCTET.test(part))) return null;
  return parts.reduce((value, part) => (value << 8n) | BigInt(part), 0n);
}

function parseIpv6(text: string): bigint | null {
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const groups = (half: string): bigint[] | null => {
    if (!half) return [];
    const parts = half.split(":");
    const values: bigint[] = [];
    for (const [index, part] of parts.entries()) {
      if (index === parts.length - 1 && part.includes(".")) {
        const v4 = parseIpv4(part);
        if (v4 === null) return null;
        values.push(v4 >> 16n, v4 & 0xffffn);
      } else if (V6_GROUP.test(part)) {
        values.push(BigInt(`0x${part}`));
      } else {
        return null;
      }
    }
    return values;
  };
  const head = groups(halves[0] ?? "");
  const tail = halves.length === 2 ? groups(halves[1] ?? "") : [];
  if (!head || !tail) return null;
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  return [...head, ...Array<bigint>(missing).fill(0n), ...tail].reduce((value, group) => (value << 16n) | group, 0n);
}

/** A literal IPv4 or IPv6 address (`[…]` allowed); zone ids and anything else are null. */
export function parseIp(text: string): IpAddress | null {
  const bare = text.startsWith("[") && text.endsWith("]") ? text.slice(1, -1) : text;
  if (bare.includes(":")) {
    const value = parseIpv6(bare);
    return value === null ? null : { family: 6, value };
  }
  const value = parseIpv4(bare);
  return value === null ? null : { family: 4, value };
}

const bitsOf = (family: 4 | 6) => (family === 4 ? V4_BITS : V6_BITS);
const maskOf = (family: 4 | 6, prefix: number) => {
  const bits = bitsOf(family);
  return ((1n << BigInt(bits)) - 1n) ^ ((1n << BigInt(bits - prefix)) - 1n);
};

export function parseCidr(text: string): Cidr | null {
  const [address = "", prefixText, extra] = text.trim().split("/");
  if (extra !== undefined) return null;
  const ip = parseIp(address);
  if (!ip) return null;
  const prefix = prefixText === undefined ? bitsOf(ip.family) : Number(prefixText);
  if (!/^\d+$/.test(prefixText ?? "0") || !Number.isInteger(prefix) || prefix < 0 || prefix > bitsOf(ip.family)) return null;
  return { family: ip.family, network: ip.value & maskOf(ip.family, prefix), prefix };
}

export function inCidr(ip: IpAddress, cidr: Cidr): boolean {
  return ip.family === cidr.family && (ip.value & maskOf(cidr.family, cidr.prefix)) === cidr.network;
}

const cidrs = (list: string[]) => list.map((text) => parseCidr(text)!);

/** Loopback, private, CGNAT (tailnet), link-local, multicast and reserved ranges the guest must not reach. */
export const BLOCKED_V4 = cidrs([
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "224.0.0.0/3",
]);

/** `::/96` covers `::`, `::1` and IPv4-compatible addresses; IPv4-mapped ones are judged by their IPv4. */
export const BLOCKED_V6 = cidrs(["::/96", "64:ff9b::/96", "64:ff9b:1::/48", "100::/64", "fc00::/7", "fe80::/10", "fec0::/10", "ff00::/8"]);

/** Host loopback and unspecified addresses: never reachable, whatever the allowlist says (the host adb server lives there). */
const NEVER_ALLOWED = cidrs(["0.0.0.0/8", "127.0.0.0/8", "::/96"]);

/** `THEONE_EMULATOR_ALLOW_NETS`: comma-separated CIDRs; returns the invalid entry as an error. */
export function parseAllowNets(text: string | undefined): { ok: true; value: Cidr[] } | { ok: false; error: string } {
  const value: Cidr[] = [];
  for (const entry of (text ?? "").split(",").map((part) => part.trim())) {
    if (!entry) continue;
    const cidr = parseCidr(entry);
    if (!cidr) return { ok: false, error: entry };
    value.push(cidr);
  }
  return { ok: true, value };
}

/** True when the guest may not connect to `address`; unparsable addresses are blocked. */
export function isBlockedAddress(address: string, allow: readonly Cidr[] = []): boolean {
  const ip = parseIp(address);
  if (!ip) return true;
  if (ip.family === 6 && inCidr(ip, MAPPED_V4)) return isBlockedAddress(formatIpv4(ip.value & 0xffffffffn), allow);
  if (NEVER_ALLOWED.some((cidr) => inCidr(ip, cidr))) return true;
  if (allow.some((cidr) => inCidr(ip, cidr))) return false;
  return (ip.family === 4 ? BLOCKED_V4 : BLOCKED_V6).some((cidr) => inCidr(ip, cidr));
}

function formatIpv4(value: bigint): string {
  return [24n, 16n, 8n, 0n].map((shift) => String((value >> shift) & 0xffn)).join(".");
}
