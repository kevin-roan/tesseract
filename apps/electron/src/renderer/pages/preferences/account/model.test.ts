import { describe, expect, it } from "vitest";
import { FIXTURE_DEVICES, SIGNED_IN } from "../../../fixtures/account/data";
import { accountRows, deviceName, deviceSubtitle } from "./model";

describe("account model", () => {
  it("lists the account's properties", () => {
    const rows = accountRows(SIGNED_IN, "en-US");
    expect(rows.map((row) => row.key)).toEqual(["Email", "Name", "Server", "Session expires"]);
    expect(accountRows({ ...SIGNED_IN, persisted: false }).at(-1)?.value).toMatch(/until Tesseract quits/);
    expect(accountRows({ ...SIGNED_IN, account: null })).toEqual([]);
  });

  it("names devices by MagicDNS name and describes them", () => {
    expect(deviceName(FIXTURE_DEVICES[0]!)).toBe("devbox-host.tesseract.internal");
    expect(deviceName({ ...FIXTURE_DEVICES[0]!, dnsName: null })).toBe("devbox-host");
    expect(deviceSubtitle(FIXTURE_DEVICES[1]!)).toBe("Sandbox · Online · 100.64.0.2");
    expect(deviceSubtitle({ ...FIXTURE_DEVICES[2]!, lastSeen: null, kind: null, ips: [] })).toBe("Device · Offline");
  });
});
