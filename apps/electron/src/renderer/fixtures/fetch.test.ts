import { TheOneClient } from "@theone/client";
import { describe, expect, it } from "vitest";
import { fixtureFetch } from "./fetch";

const client = new TheOneClient({ baseUrl: "http://127.0.0.1:7700", token: "fixture", fetch: fixtureFetch });

describe("fixture fetch", () => {
  it("serves protocol fixtures through the real client", async () => {
    expect((await client.health()).ok).toBe(true);
    expect((await client.listProjects()).length).toBeGreaterThan(0);
    expect((await client.getProject("monolith")).id).toBe("monolith");
  });

  it("answers unknown routes with a typed 404", async () => {
    await expect(client.getProject("missing")).rejects.toMatchObject({ status: 404 });
  });
});
