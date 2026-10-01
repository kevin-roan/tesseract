import type { ListeningPort } from "@theone/protocol";
import { sampleProcess, sampleProject } from "@theone/protocol/fixtures";

import { processSite, projectSites, siteLabel, siteUrl, sortSites } from "@/features/sandbox/utils/sites";

import { TEST_SITE } from "../helpers";

const dnsOnly: ListeningPort = { ...TEST_SITE, port: 3000, url: null };
const offline: ListeningPort = { ...TEST_SITE, port: 4000, url: null, dnsUrl: null };
const stray: ListeningPort = { ...TEST_SITE, port: 8080, processId: null, projectId: null };

describe("siteUrl", () => {
  it("prefers the Tailscale IP link, then MagicDNS, then nothing", () => {
    expect(siteUrl(TEST_SITE)).toBe("http://100.116.96.29:5173");
    expect(siteUrl(dnsOnly)).toBe(TEST_SITE.dnsUrl);
    expect(siteUrl(offline)).toBeNull();
  });
});

describe("siteLabel", () => {
  it("shows the port", () => {
    expect(siteLabel(TEST_SITE)).toBe(":5173");
  });
});

describe("sortSites", () => {
  it("orders by port without mutating the input", () => {
    const input = [stray, TEST_SITE, dnsOnly];
    expect(sortSites(input).map((site) => site.port)).toEqual([3000, 5173, 8080]);
    expect(input[0]).toBe(stray);
    expect(sortSites(undefined)).toEqual([]);
  });
});

describe("projectSites", () => {
  it("keeps only the project's ports", () => {
    expect(projectSites([stray, TEST_SITE, dnsOnly], sampleProject.id).map((site) => site.port)).toEqual([3000, 5173]);
    expect(projectSites([stray], sampleProject.id)).toEqual([]);
    expect(projectSites(undefined, sampleProject.id)).toEqual([]);
  });
});

describe("processSite", () => {
  it("finds the lowest reachable port of a process", () => {
    expect(processSite([stray, TEST_SITE, dnsOnly], sampleProcess.id)).toBe(dnsOnly);
    expect(processSite([offline], sampleProcess.id)).toBeUndefined();
    expect(processSite([stray], sampleProcess.id)).toBeUndefined();
    expect(processSite(undefined, sampleProcess.id)).toBeUndefined();
  });
});
