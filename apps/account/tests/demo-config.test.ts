import { afterEach, describe, expect, test } from "bun:test";
import { loadConfig } from "../src/config";
import { seedDemoAccount } from "../src/demo";
import { RateLimiter } from "../src/rate-limit";
import { Store } from "../src/store";

const required = {
  ACCOUNT_HEADSCALE_URL: "http://headscale:8080/",
  ACCOUNT_HEADSCALE_API_KEY: "key",
  ACCOUNT_LOGIN_SERVER: "https://net.example.com",
};

describe("seedDemoAccount", () => {
  let store: Store;
  afterEach(() => store.close());

  test("is idempotent and follows password changes", async () => {
    store = new Store(":memory:");
    expect(await seedDemoAccount(store, null, null)).toBe("skipped");
    expect(await seedDemoAccount(store, "Review@Example.com", "review password 1")).toBe("created");
    expect(await seedDemoAccount(store, "review@example.com", "review password 1")).toBe("unchanged");
    expect(await seedDemoAccount(store, "review@example.com", "review password 2")).toBe("updated");
    const row = store.accountByEmail("review@example.com")!;
    expect(row.provider).toBe("password");
    expect(await Bun.password.verify("review password 2", row.password_hash!)).toBe(true);
    expect(store.db.query("SELECT count(*) AS n FROM accounts").get()).toEqual({ n: 1 });
  });

  test("rejects a password shorter than the account minimum", async () => {
    store = new Store(":memory:");
    await expect(seedDemoAccount(store, "review@example.com", "short")).rejects.toThrow();
  });
});

describe("loadConfig", () => {
  test("defaults", () => {
    const config = loadConfig(required);
    expect(config.port).toBe(7800);
    expect(config.netDomain).toBe("tesseract.internal");
    expect(config.headscaleUrl).toBe("http://headscale:8080");
    expect(config.appleAudiences).toEqual([]);
    expect(config.trustProxy).toBe(false);
  });

  test("reads the environment", () => {
    const config = loadConfig({
      ...required,
      ACCOUNT_PORT: "9000",
      ACCOUNT_DATA_DIR: "/var/lib/account",
      ACCOUNT_NET_DOMAIN: "net.example",
      ACCOUNT_APPLE_AUDIENCES: "a.b, c.d ,",
    });
    expect(config).toMatchObject({ port: 9000, dbPath: "/var/lib/account/account.sqlite", netDomain: "net.example", appleAudiences: ["a.b", "c.d"] });
  });

  test("requires the Headscale settings", () => {
    expect(() => loadConfig({})).toThrow("ACCOUNT_HEADSCALE_URL is required");
    expect(() => loadConfig({ ...required, ACCOUNT_PORT: "abc" })).toThrow();
  });
});

describe("RateLimiter", () => {
  test("resets after the window", () => {
    let clock = 0;
    const limiter = new RateLimiter({ max: 2, windowMs: 1000 }, () => clock);
    expect([limiter.hit("ip"), limiter.hit("ip"), limiter.hit("ip")]).toEqual([0, 0, 1]);
    expect(limiter.hit("other")).toBe(0);
    clock = 1000;
    expect(limiter.hit("ip")).toBe(0);
  });
});
