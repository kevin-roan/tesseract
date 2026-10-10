import { describe, expect, it } from "vitest";
import { analyzeTailnet, authErrors, findPeers, parseServe, parseStatus, type TailnetFacts, type TailnetNode } from "./tailnet";

const statusJson = (suffix: string, dns: string, ip: string, extra: object = {}) =>
  JSON.stringify({
    BackendState: "Running",
    TailscaleIPs: [ip, "fd7a::1"],
    CurrentTailnet: { Name: "me@example.com", MagicDNSSuffix: suffix },
    CertDomains: [dns],
    Self: { HostName: dns.split(".")[0], DNSName: `${dns}.`, Online: true, KeyExpiry: "0001-01-01T00:00:00Z" },
    ...extra,
  });

const node = (suffix: string, dns: string, ip: string): TailnetNode => parseStatus(statusJson(suffix, dns, ip)) as TailnetNode;

function facts(overrides: Partial<TailnetFacts> = {}): TailnetFacts {
  return {
    mode: "tailscale",
    configuredMode: "tailscale",
    hostname: "tesseract-sandbox",
    envDomain: "tailnew.ts.net",
    authKeySaved: false,
    tailscaleCli: true,
    host: node("tailnew.ts.net", "mac.tailnew.ts.net", "100.80.0.1"),
    hostError: null,
    sidecarContainer: "tesseract-tailscale-1",
    sidecar: node("tailnew.ts.net", "tesseract-sandbox.tailnew.ts.net", "100.90.0.2"),
    sidecarLogErrors: [],
    volume: "tesseract-tailscale",
    volumeCreated: "2026-10-01T10:00:00Z",
    publicUrl: "https://tesseract-sandbox.tailnew.ts.net",
    peerVisible: true,
    otherPeers: [],
    ping: { ok: true, detail: "pong" },
    controllerUp: true,
    sidecarReachesController: true,
    sidecarServesController: true,
    httpsCode: "200",
    resolvedIp: "100.90.0.2",
    hostServe: [{ front: "mac.tailnew.ts.net:8443/", target: "http://100.80.0.1:7701" }],
    hostShellPort: 7701,
    hostShellAnswers: true,
    restartHostShell: "launchctl kickstart -k gui/$(id -u)/dev.tesseract.host-shell",
    ...overrides,
  };
}

const errors = (items: ReturnType<typeof analyzeTailnet>) => items.filter((item) => item.status === "error").map((item) => item.id);

describe("parsers", () => {
  it("reads the node, tailnet and IPv4 from tailscale status", () => {
    expect(parseStatus(statusJson("tail1.ts.net", "box.tail1.ts.net", "100.1.2.3"))).toMatchObject({
      state: "Running",
      suffix: "tail1.ts.net",
      dnsName: "box.tail1.ts.net",
      ip: "100.1.2.3",
      keyExpiry: null,
    });
    expect(parseStatus("not json")).toBeNull();
  });

  it("finds the sidecar among peers and old copies of it", () => {
    const text = JSON.stringify({
      BackendState: "Running",
      Peer: {
        a: { HostName: "tesseract-sandbox", DNSName: "tesseract-sandbox-1.t.ts.net.", TailscaleIPs: ["100.9.9.9"], Online: true },
        b: { HostName: "tesseract-sandbox", DNSName: "tesseract-sandbox.t.ts.net.", TailscaleIPs: ["100.1.1.1"], Online: false, LastSeen: "2026-09-01" },
        c: { HostName: "phone", DNSName: "phone.t.ts.net.", TailscaleIPs: ["100.2.2.2"] },
      },
    });
    const peers = findPeers(text, "tesseract-sandbox", "100.9.9.9");
    expect(peers.visible).toBe(true);
    expect(peers.others).toEqual([{ dnsName: "tesseract-sandbox.t.ts.net", ip: "100.1.1.1", online: false, lastSeen: "2026-09-01" }]);
  });

  it("lists serve proxies and auth errors", () => {
    expect(parseServe(JSON.stringify({ Web: { "mac.t.ts.net:8443": { Handlers: { "/": { Proxy: "http://100.1.1.1:7701" } } } } }))).toEqual([
      { front: "mac.t.ts.net:8443/", target: "http://100.1.1.1:7701" },
    ]);
    expect(authErrors("boot\nbackend error: invalid key: unable to validate API key\nok")).toEqual(["backend error: invalid key: unable to validate API key"]);
  });
});

describe("analyzeTailnet", () => {
  it("passes a healthy setup", () => {
    expect(errors(analyzeTailnet(facts()))).toEqual([]);
  });

  it("flags a sidecar left on the old tailnet after a key switch", () => {
    const items = analyzeTailnet(
      facts({
        sidecar: node("tailold.ts.net", "tesseract-sandbox.tailold.ts.net", "100.90.0.2"),
        publicUrl: "https://tesseract-sandbox.tailnew.ts.net",
        authKeySaved: true,
        peerVisible: false,
      }),
    );
    expect(errors(items)).toEqual(["same-tailnet", "domain", "url", "key", "peer"]);
    expect(items.find((item) => item.id === "same-tailnet")?.detail).toContain("--reset-tailscale");
  });

  it("explains a logged-out sidecar and a renamed node", () => {
    const loggedOut = analyzeTailnet(facts({ sidecar: { ...node("", "", ""), state: "NeedsLogin" } }));
    expect(loggedOut.find((item) => item.id === "sidecar")).toMatchObject({ status: "error", title: "The sandbox sidecar is logged out of the tailnet" });
    const renamed = analyzeTailnet(facts({ sidecar: node("tailnew.ts.net", "tesseract-sandbox-1.tailnew.ts.net", "100.90.0.2") }));
    expect(renamed.find((item) => item.id === "url")?.detail).toContain("An old tesseract-sandbox node still exists");
    expect(renamed.find((item) => item.id === "url")?.detail).toContain("tesseract sandbox restart");
  });

  it("flags a sidecar that lost the sandbox's network after a lone restart", () => {
    const items = analyzeTailnet(facts({ sidecarReachesController: false, httpsCode: "000" }));
    expect(errors(items)).toEqual(["netns", "health"]);
    expect(items.find((item) => item.id === "netns")?.detail).toContain("tesseract sandbox restart");
  });

  it("shows why tailscale status failed on the host", () => {
    const items = analyzeTailnet(facts({ host: null, hostError: "The Tailscale GUI failed to start" }));
    expect(items[0]).toMatchObject({ status: "error", title: "tailscale status failed on this computer" });
    expect(items[0]?.detail).toContain("The Tailscale GUI failed to start");
  });

  it("treats a relayed ping as a warning, not a failure", () => {
    const items = analyzeTailnet(facts({ ping: { ok: false, detail: "direct connection not established" } }));
    expect(items.find((item) => item.id === "ping")).toMatchObject({ status: "warning" });
  });

  it("flags a host shell front on the host's old IP", () => {
    const items = analyzeTailnet(facts({ hostServe: [{ front: "mac.tailnew.ts.net:8443/", target: "http://100.70.0.9:7701" }] }));
    expect(items.find((item) => item.id === "host-shell")).toMatchObject({ status: "error" });
    expect(items.find((item) => item.id === "host-shell")?.detail).toContain("launchctl kickstart");
  });

  it("only checks the host outside tailscale mode", () => {
    expect(analyzeTailnet(facts({ mode: "local", configuredMode: "local" })).map((item) => item.id)).toEqual(["host", "mode", "host-shell"]);
  });

  it("warns when the running stack is not the configured mode", () => {
    expect(analyzeTailnet(facts({ configuredMode: "host-tailscale" })).find((item) => item.id === "mode")).toMatchObject({ status: "warning" });
  });
});
