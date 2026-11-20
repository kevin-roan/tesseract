import { describe, expect, test } from "bun:test";
import { CreateAccountSchema, CreateDeviceKeySchema, TailnetStatusSchema } from "../src";

describe("account schemas", () => {
  test("normalizes the email and enforces the password length", () => {
    expect(CreateAccountSchema.parse({ email: " Me@Example.COM ", password: "0123456789" }).email).toBe("me@example.com");
    expect(CreateAccountSchema.safeParse({ email: "me@example.com", password: "short" }).success).toBe(false);
  });

  test("accepts DNS-label hostnames only", () => {
    expect(CreateDeviceKeySchema.parse({ kind: "mobile", hostname: "Kevins-iPhone" }).hostname).toBe("kevins-iphone");
    expect(CreateDeviceKeySchema.safeParse({ kind: "mobile", hostname: "a b" }).success).toBe(false);
    expect(CreateDeviceKeySchema.safeParse({ kind: "toaster", hostname: "a" }).success).toBe(false);
  });

  test("parses a running tailnet status", () => {
    const status = TailnetStatusSchema.parse({
      state: "running",
      hostName: "phone",
      dnsName: "phone.tesseract.internal",
      ips: ["100.64.0.2"],
      magicDnsSuffix: "tesseract.internal",
      loginServer: "https://net.example.com",
      error: null,
      peers: [{ hostName: "sandbox", dnsName: "sandbox.tesseract.internal", ips: ["100.64.0.3"], os: "linux", online: true }],
    });
    expect(status.peers).toHaveLength(1);
  });
});
