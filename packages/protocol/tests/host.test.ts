import { describe, expect, test } from "bun:test";
import {
  buildPairingLink,
  HOST_PAIRING_ACTION,
  HostHealthSchema,
  HostLockStatusSchema,
  HostSessionSchema,
  HostUnlockSchema,
  parsePairingLink,
  PROTOCOL_VERSION,
  restPaths,
  routePatterns,
} from "../src/index";

const TOKEN = "q3Jx0mZ8yWv1_bT7-kLp2sR4nC6dE9fG0hI1jK2lM3n";

describe("host shell schemas", () => {
  test("health names the service and host", () => {
    const health = { ok: true as const, service: "host-shell" as const, version: "0.1.0", protocolVersion: PROTOCOL_VERSION, hostId: "workstation" };
    expect(HostHealthSchema.parse(health)).toEqual(health);
    expect(HostHealthSchema.safeParse({ ...health, service: "controller" }).success).toBe(false);
    expect(HostHealthSchema.safeParse({ ok: true, version: "1", protocolVersion: PROTOCOL_VERSION, sandboxId: "x" }).success).toBe(false);
  });

  test("lock status", () => {
    expect(HostLockStatusSchema.parse({ pinSet: true, attemptsLeft: 5, lockedUntil: null }).attemptsLeft).toBe(5);
    expect(HostLockStatusSchema.parse({ pinSet: true, attemptsLeft: 0, lockedUntil: "2026-10-01T10:05:00.000Z" }).lockedUntil).not.toBeNull();
    expect(HostLockStatusSchema.safeParse({ pinSet: true, attemptsLeft: -1, lockedUntil: null }).success).toBe(false);
  });

  test("PINs are 6 to 12 digits", () => {
    for (const pin of ["123456", "123456789012"]) expect(HostUnlockSchema.safeParse({ pin }).success).toBe(true);
    for (const pin of ["12345", "1234567890123", "12345a", " 123456", ""]) expect(HostUnlockSchema.safeParse({ pin }).success).toBe(false);
  });

  test("session", () => {
    expect(HostSessionSchema.safeParse({ session: "", expiresAt: "2026-10-01T10:15:00.000Z" }).success).toBe(false);
    expect(HostSessionSchema.parse({ session: "abc", expiresAt: "2026-10-01T10:15:00.000Z" }).session).toBe("abc");
  });

  test("routes", () => {
    expect(restPaths.hostLock()).toBe("/v1/host/lock");
    expect(restPaths.hostUnlock()).toBe("/v1/host/unlock");
    expect(routePatterns.rest.hostLock).toBe("/v1/host/lock");
    expect(routePatterns.rest.hostUnlock).toBe("/v1/host/unlock");
  });
});

describe("host pairing links", () => {
  test("round-trip through tesseract://host", () => {
    const link = buildPairingLink({ url: "http://100.101.102.103:7701", token: TOKEN, name: "workstation" }, HOST_PAIRING_ACTION);
    expect(link.startsWith("tesseract://host?")).toBe(true);
    expect(parsePairingLink(link, HOST_PAIRING_ACTION)).toEqual({
      ok: true,
      value: { url: "http://100.101.102.103:7701", token: TOKEN, name: "workstation" },
    });
  });

  test("a sandbox link is not a host link and vice versa", () => {
    const host = buildPairingLink({ url: "http://100.101.102.103:7701", token: TOKEN }, HOST_PAIRING_ACTION);
    const sandbox = buildPairingLink({ url: "http://127.0.0.1:7700", token: TOKEN });
    expect(parsePairingLink(host)).toMatchObject({ ok: false, error: { code: "invalid_action" } });
    expect(parsePairingLink(sandbox, HOST_PAIRING_ACTION)).toMatchObject({ ok: false, error: { code: "invalid_action", message: "Pairing link must be tesseract://host?…" } });
  });
});
