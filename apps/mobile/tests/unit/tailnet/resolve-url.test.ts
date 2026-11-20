import type { DeviceKey, TailnetStatus } from "@tesseract/protocol";

import {
  connectTailnet,
  disconnectTailnet,
  peekTailnetUrl,
  resolveTailnetUrl,
  resumeTailnet,
  tailnetTransport,
} from "@/features/tailnet";
import { useTailnetStore } from "@/features/tailnet/store/tailnet-store";
import { isCgnatAddress, tailnetTargetOf } from "@/features/tailnet/utils/url";

const mockForward = jest.fn<Promise<number>, [string, number]>();
const mockStatus = jest.fn<Promise<TailnetStatus | null>, []>();
const mockStart = jest.fn<Promise<void>, [unknown]>();
const mockStop = jest.fn<Promise<void>, []>();

jest.mock("@/modules/tesseract-tailnet", () => ({
  isTailnetAvailable: () => true,
  start: (options: unknown) => mockStart(options),
  stop: () => mockStop(),
  logout: () => Promise.resolve(),
  status: () => mockStatus(),
  forward: (host: string, port: number) => mockForward(host, port),
  closeForward: () => Promise.resolve(),
  addStatusListener: () => ({ remove: () => undefined }),
}));

const SUFFIX = "tesseract.internal";

const status = (state: TailnetStatus["state"]): TailnetStatus => ({
  state,
  hostName: "phone",
  dnsName: `phone.${SUFFIX}.`,
  ips: ["100.64.0.2"],
  magicDnsSuffix: SUFFIX,
  loginServer: "https://hs.example.com",
  error: null,
  peers: [],
});

const key: DeviceKey = {
  authKey: "key-1",
  loginServer: "https://hs.example.com",
  magicDnsSuffix: SUFFIX,
  hostname: "phone",
  tags: ["tag:tesseract-mobile"],
  expiresAt: "2026-11-08T12:00:00.000Z",
};

describe("tailnet URL helpers", () => {
  it("recognises 100.64.0.0/10 only", () => {
    expect(isCgnatAddress("100.64.0.1")).toBe(true);
    expect(isCgnatAddress("100.127.255.254")).toBe(true);
    expect(isCgnatAddress("100.128.0.1")).toBe(false);
    expect(isCgnatAddress("100.63.0.1")).toBe(false);
    expect(isCgnatAddress("10.0.0.1")).toBe(false);
  });

  it("matches hosts under the MagicDNS suffix with protocol default ports", () => {
    expect(tailnetTargetOf(`http://box.${SUFFIX}/v1/health`, SUFFIX)).toEqual({
      scheme: "http",
      host: `box.${SUFFIX}`,
      port: 80,
      rest: "/v1/health",
    });
    expect(tailnetTargetOf(`wss://box.${SUFFIX}:7700/ws?ticket=1`, `.${SUFFIX}.`)?.port).toBe(7700);
    expect(tailnetTargetOf(`https://box.${SUFFIX}`, SUFFIX)?.port).toBe(443);
    expect(tailnetTargetOf(`http://${SUFFIX}.evil.com`, SUFFIX)).toBeNull();
    expect(tailnetTargetOf("https://box.example.ts.net", SUFFIX)).toBeNull();
  });
});

describe("resolveTailnetUrl", () => {
  beforeEach(async () => {
    mockForward.mockReset();
    mockStart.mockReset().mockResolvedValue(undefined);
    mockStop.mockReset().mockResolvedValue(undefined);
    mockStatus.mockReset().mockResolvedValue(status("running"));
    useTailnetStore.setState({ status: null, config: null });
    await connectTailnet(key);
  });

  it("starts the node with the device key", () => {
    expect(mockStart).toHaveBeenCalledWith({ controlUrl: key.loginServer, authKey: key.authKey, hostname: key.hostname });
    expect(useTailnetStore.getState().status?.state).toBe("running");
  });

  it("rewrites MagicDNS hosts to a loopback forward, keeping path and query", async () => {
    mockForward.mockResolvedValue(41000);
    await expect(resolveTailnetUrl(`http://box.${SUFFIX}:7700/ui/vnc?ticket=a#x`)).resolves.toBe(
      "http://127.0.0.1:41000/ui/vnc?ticket=a#x",
    );
    expect(mockForward).toHaveBeenCalledWith(`box.${SUFFIX}`, 7700);
  });

  it("rewrites CGNAT addresses and maps wss to ws", async () => {
    mockForward.mockResolvedValue(41001);
    await expect(resolveTailnetUrl("wss://100.100.1.2/v1/ws")).resolves.toBe("ws://127.0.0.1:41001/v1/ws");
    expect(mockForward).toHaveBeenCalledWith("100.100.1.2", 443);
  });

  it("leaves other URLs untouched", async () => {
    const urls = ["https://box.example.ts.net/v1/health", "http://192.168.1.4:7700/", "http://100.128.0.1:7700/"];
    for (const url of urls) await expect(resolveTailnetUrl(url)).resolves.toBe(url);
    expect(mockForward).not.toHaveBeenCalled();
    expect(peekTailnetUrl(urls[0])).toBe(urls[0]);
  });

  it("caches one forward per host and port", async () => {
    mockForward.mockResolvedValueOnce(42000).mockResolvedValueOnce(42001);
    const host = `http://box.${SUFFIX}:7700`;
    expect(peekTailnetUrl(`${host}/a`)).toBeNull();
    await Promise.all([resolveTailnetUrl(`${host}/a`), resolveTailnetUrl(`${host}/b`)]);
    await expect(resolveTailnetUrl(`${host}/c`)).resolves.toBe("http://127.0.0.1:42000/c");
    expect(peekTailnetUrl(`${host}/d`)).toBe("http://127.0.0.1:42000/d");
    await expect(resolveTailnetUrl(`http://box.${SUFFIX}:7701/`)).resolves.toBe("http://127.0.0.1:42001/");
    expect(mockForward).toHaveBeenCalledTimes(2);
  });

  it("drops a failed forward so the next call retries", async () => {
    mockForward.mockRejectedValueOnce(new Error("no route")).mockResolvedValueOnce(43000);
    await expect(resolveTailnetUrl(`http://box.${SUFFIX}/`)).rejects.toThrow("no route");
    await expect(resolveTailnetUrl(`http://box.${SUFFIX}/`)).resolves.toBe("http://127.0.0.1:43000/");
  });

  it("returns URLs unchanged and forgets forwards once the node stops", async () => {
    mockForward.mockResolvedValue(44000);
    const url = `http://box.${SUFFIX}/`;
    await resolveTailnetUrl(url);
    mockStatus.mockResolvedValue(status("stopped"));
    await disconnectTailnet();
    expect(peekTailnetUrl(url)).toBeNull();
    await expect(resolveTailnetUrl(url)).resolves.toBe(url);
  });

  it("resumes from the stored login server without a key", async () => {
    mockStatus.mockResolvedValue(status("stopped"));
    await disconnectTailnet();
    useTailnetStore.setState({ status: null, config: null });
    mockStart.mockClear();
    await resumeTailnet();
    expect(mockStart).toHaveBeenCalledWith({ controlUrl: key.loginServer, authKey: undefined, hostname: key.hostname });
  });
});

describe("tailnetTransport", () => {
  const opened: string[] = [];
  class FakeSocket {
    readyState = 0;
    onopen: ((event: unknown) => void) | null = null;
    onmessage = null;
    onerror = null;
    onclose = null;
    constructor(url: string) {
      opened.push(url);
    }
    send() {}
    close() {}
  }
  const realWebSocket = globalThis.WebSocket;

  beforeEach(async () => {
    opened.length = 0;
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeSocket;
    mockForward.mockReset().mockResolvedValue(45000);
    mockStatus.mockReset().mockResolvedValue(status("running"));
    mockStart.mockReset().mockResolvedValue(undefined);
    useTailnetStore.setState({ status: null, config: null });
    await connectTailnet(key);
  });

  afterEach(() => {
    globalThis.WebSocket = realWebSocket;
  });

  it("opens tailnet sockets on the forwarded port and others directly", async () => {
    const direct = new tailnetTransport.WebSocket("wss://box.example.ts.net/v1/ws");
    expect(direct).toBeInstanceOf(FakeSocket);
    const deferred = new tailnetTransport.WebSocket(`ws://box.${SUFFIX}:7700/v1/ws?ticket=t`);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(opened).toEqual(["wss://box.example.ts.net/v1/ws", "ws://127.0.0.1:45000/v1/ws?ticket=t"]);
    expect(deferred).not.toBeInstanceOf(FakeSocket);
  });
});
