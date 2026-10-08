import { ApiError, NetworkError, ProtocolError, ProtocolVersionError, TimeoutError } from "@tesseract/client";
import { describe, expect, it } from "vitest";
import { describeError, isRetryable, NotConfiguredError, statusForError } from "./describe-error";
import { connectionBanner, connectionView, statusTitle } from "./view";
import { INITIAL_CONNECTION_STATE } from "./constants";

describe("describeError", () => {
  it("maps client errors to the GTK messages", () => {
    expect(describeError(null)).toBe("");
    expect(describeError(new ApiError(401, "unauthorized", "nope"))).toBe(
      "The sandbox rejected this token. Update it in Preferences or rediscover the sandbox.",
    );
    expect(describeError(new ApiError(403, "forbidden", "Forbidden here"))).toBe("Forbidden here");
    expect(describeError(new ApiError(502, "internal", "Bad Gateway"))).toBe(
      "HTTP 502 from the proxy in front of the controller: the controller is not answering behind it.",
    );
    expect(describeError(new ApiError(503, "unavailable", "busy upgrading"))).toBe("busy upgrading");
    expect(describeError(new TimeoutError("/v1/status", 15_000))).toBe("The sandbox took too long to answer.");
    expect(describeError(new NetworkError("x"))).toBe(
      "Can't reach the sandbox. Check that the stack is running and the URL is reachable from this machine.",
    );
    expect(describeError(new ProtocolVersionError("/v1/health", 2, 1))).toBe(
      "The sandbox speaks protocol v2 and this app speaks v1. Update the app or the sandbox so they match.",
    );
    expect(describeError(new ProtocolError("/v1/status", "bad"))).toBe(
      "The controller answered in an unexpected format. Update the app or the sandbox so their versions match.",
    );
    expect(describeError(new NotConfiguredError())).toBe(
      "No sandbox is configured yet. Open Preferences to discover it or enter its URL and token.",
    );
    expect(describeError(new Error(""))).toBe("Something went wrong.");
  });

  it("classifies statuses like GTK (403 is not unauthorized)", () => {
    expect(statusForError(new ApiError(401, "internal", "x"))).toBe("unauthorized");
    expect(statusForError(new ApiError(403, "forbidden", "x"))).toBe("offline");
    expect(statusForError(new ProtocolVersionError("/v1/health", 2, 1))).toBe("incompatible");
    expect(statusForError(new NotConfiguredError())).toBe("unconfigured");
    expect(statusForError(new NetworkError("x"))).toBe("offline");
  });

  it("knows what is retryable", () => {
    expect(isRetryable(new ApiError(500, "internal", "x"))).toBe(true);
    expect(isRetryable(new ApiError(429, "internal", "x"))).toBe(true);
    expect(isRetryable(new ApiError(404, "not_found", "x"))).toBe(false);
    expect(isRetryable(new ProtocolError("/", "x"))).toBe(false);
    expect(isRetryable(new NetworkError("x"))).toBe(true);
  });
});

describe("connection view", () => {
  const config = { apiUrl: "http://127.0.0.1:7700", token: "t", name: "rig", pairingUrl: null, source: "docker" as const };

  it("builds labels, tones and the source", () => {
    const view = connectionView({ ...INITIAL_CONNECTION_STATE, status: "online", config, configFile: "/c.json", events: "open" });
    expect(view).toMatchObject({
      label: "Online",
      tone: "success",
      title: "rig",
      detail: "Online · Live",
      dotTone: "success",
      tooltip: "Connection settings",
      eventsLabel: "Live",
      eventsTone: "success",
      sourceLabel: "Docker discovery",
      configFileLabel: "Config file: /c.json",
      banner: null,
    });
    expect(statusTitle({ status: "offline", config, health: null })).toBe("rig · Offline");
    expect(connectionView(INITIAL_CONNECTION_STATE).title).toBe("Sandbox");
    expect(connectionView({ ...INITIAL_CONNECTION_STATE, status: "offline", errorMessage: "down" })).toMatchObject({
      detail: "Offline",
      dotTone: "danger",
      tooltip: "down",
    });
  });

  it("produces the banner for each status", () => {
    expect(connectionBanner({ status: "unconfigured", errorMessage: null })).toMatchObject({
      title: "No sandbox is configured on this machine yet.",
      action: "setup",
      actionLabel: "Set Up",
      tone: "neutral",
    });
    expect(connectionBanner({ status: "discovering", errorMessage: null })).toMatchObject({ action: null, tone: "info" });
    expect(connectionBanner({ status: "offline", errorMessage: "boom" })).toMatchObject({
      title: "Can't reach the sandbox: boom",
      actionLabel: "Retry",
      tone: "danger",
    });
    expect(connectionBanner({ status: "unauthorized", errorMessage: null })?.actionLabel).toBe("Fix Connection");
    expect(connectionBanner({ status: "incompatible", errorMessage: "v2" })).toMatchObject({ title: "v2", actionLabel: "Details" });
    expect(connectionBanner({ status: "connecting", errorMessage: null })).toBeNull();
  });
});
