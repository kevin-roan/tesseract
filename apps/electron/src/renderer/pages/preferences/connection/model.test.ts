import { describe, expect, it } from "vitest";
import { connectionStatusRows, formFromConfig, readConnectionForm } from "./model";

const config = { apiUrl: "http://172.22.0.2:7700", token: "secret", name: "tesseract-sandbox", pairingUrl: null, source: "docker" as const };

describe("connection preferences model", () => {
  it("normalizes the form", () => {
    expect(readConnectionForm({ apiUrl: " http://Example.com:80/v1/ ", token: " t ", name: "  ", pairingUrl: "" })).toEqual({
      apiUrl: "http://example.com",
      token: "t",
      name: null,
      pairingUrl: null,
    });
  });

  it("rejects invalid input, including an invalid pairing URL", () => {
    expect(readConnectionForm({ apiUrl: "ftp://x", token: "t", name: "", pairingUrl: "" })).toBeNull();
    expect(readConnectionForm({ apiUrl: "http://x", token: " ", name: "", pairingUrl: "" })).toBeNull();
    expect(readConnectionForm({ apiUrl: "http://x", token: "t", name: "", pairingUrl: "nope" })).toBeNull();
  });

  it("fills the form from a config", () => {
    expect(formFromConfig(config)).toEqual({ apiUrl: config.apiUrl, token: "secret", name: "tesseract-sandbox", pairingUrl: "" });
    expect(formFromConfig(null).apiUrl).toBe("");
  });

  it("describes the status rows", () => {
    const rows = connectionStatusRows({ status: "online", errorMessage: null, health: null, config, configFile: "/tmp/config.json" });
    expect(rows).toEqual({
      badge: { label: "Online", tone: "success" },
      statusSubtitle: "tesseract-sandbox",
      sourceTitle: "Source: Docker discovery",
      sourceSubtitle: "Config file: /tmp/config.json",
      discovering: false,
    });
    const empty = connectionStatusRows({ status: "discovering", errorMessage: null, health: null, config: null, configFile: null });
    expect(empty.sourceTitle).toBe("Source");
    expect(empty.discovering).toBe(true);
  });
});
