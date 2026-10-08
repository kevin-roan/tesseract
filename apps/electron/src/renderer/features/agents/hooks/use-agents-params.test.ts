import { afterEach, describe, expect, it, vi } from "vitest";
import { resetAgentsUi, useAgentsUi } from "../store";
import { applyAgentsParams, isOneShot, paramsFromSearch, paramsFromSubroute } from "./use-agents-params";

afterEach(resetAgentsUi);

describe("agents navigation params", () => {
  it("selects a run", () => {
    applyAgentsParams({ runId: "run_1" }, vi.fn());
    expect(useAgentsUi.getState()).toMatchObject({ view: "conversation", selectedRunId: "run_1" });
  });

  it("opens the new view and starts immediately with send", () => {
    const start = vi.fn();
    applyAgentsParams({ prompt: "Fix it", send: true, projectId: "tesseract", attachmentIds: ["upl_1"] }, start);
    expect(useAgentsUi.getState()).toMatchObject({ view: "new", draft: { prompt: "Fix it", projectId: "tesseract" } });
    expect(start).toHaveBeenCalledWith({ prompt: "Fix it", projectId: "tesseract", attachmentIds: ["upl_1"] });
  });

  it("recognises one-shot send params", () => {
    expect(isOneShot({ prompt: "Fix it", send: true })).toBe(true);
    expect(isOneShot({ prompt: "Fix it" })).toBe(false);
    expect(isOneShot({ send: true })).toBe(false);
    expect(isOneShot(null)).toBe(false);
  });

  it("prefills the new view without sending", () => {
    const start = vi.fn();
    applyAgentsParams({ projectId: "tesseract" }, start);
    expect(useAgentsUi.getState()).toMatchObject({ view: "new", draft: { prompt: "", projectId: "tesseract" } });
    expect(start).not.toHaveBeenCalled();
  });

  it("reveals search and sets filters", () => {
    useAgentsUi.getState().setSidebarOpen(false);
    applyAgentsParams({ search: true }, vi.fn());
    expect(useAgentsUi.getState()).toMatchObject({ searchOpen: true, sidebarOpen: true });
    applyAgentsParams({ filter: "archived" }, vi.fn());
    expect(useAgentsUi.getState().filter).toBe("archived");
    applyAgentsParams({ filter: "bogus" }, vi.fn());
    expect(useAgentsUi.getState().filter).toBe("archived");
  });

  it("reads sub-routes and search params", () => {
    expect(paramsFromSubroute("new")).toEqual({ new: true });
    expect(paramsFromSubroute("run_abc")).toEqual({ runId: "run_abc" });
    expect(paramsFromSubroute("")).toBeNull();
    expect(paramsFromSearch(new URLSearchParams("filter=running"))).toEqual({ filter: "running" });
    expect(paramsFromSearch(new URLSearchParams("search"))).toEqual({ search: true });
    expect(paramsFromSearch(new URLSearchParams("scenario=x"))).toBeNull();
  });
});
