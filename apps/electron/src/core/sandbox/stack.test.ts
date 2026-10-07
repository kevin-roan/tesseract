import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { claudeAccountsYaml, composeArgs, parseClaudeAccounts, resolveStack, yamlString } from "./stack";
import { FakeDocker, ok, tempStack, type TempStack } from "./test-support";

let stack: TempStack;

afterEach(() => stack?.cleanup());

function withEnv(text: string) {
  stack = tempStack();
  return (deps = new FakeDocker().deps(), env?: NodeJS.ProcessEnv) => {
    const context = stack.context(deps, env);
    mkdirSync(dirname(context.envFile), { recursive: true });
    writeFileSync(context.envFile, text);
    return context;
  };
}

describe("resolveStack", () => {
  it("local mode: compose.yml + compose.local.yml bound to 127.0.0.1, exports resolved values only", async () => {
    const context = withEnv("THEONE_MODE=local\nTHEONE_COMPOSE_PROJECT=monolith-test-a\nTHEONE_CONTROLLER_HOST_PORT=7811\n")(
      undefined,
      { PATH: "/bin", HOME: "/home/u", THEONE_TOKEN: "leak", THEONE_COMPOSE_PROJECT: "other", COMPOSE_FILE: "x.yml" },
    );
    const resolved = await resolveStack(context, "up");
    const composeDir = join(context.contextDir, "infra", "compose");
    expect(resolved.files).toEqual([join(composeDir, "compose.yml"), join(composeDir, "compose.local.yml")]);
    expect(resolved.env).toEqual({
      PATH: "/bin",
      HOME: "/home/u",
      THEONE_COMPOSE_PROJECT: "monolith-test-a",
      THEONE_VOLUME_PREFIX: "monolith-test-a",
      THEONE_CONTROLLER_HOST_PORT: "7811",
      THEONE_VNC_HOST_PORT: "5901",
      THEONE_BIND_ADDR: "127.0.0.1",
    });
    expect(composeArgs(resolved, ["ps"])).toEqual([
      "compose",
      "--project-name",
      "monolith-test-a",
      "--project-directory",
      composeDir,
      "--env-file",
      context.envFile,
      "-f",
      join(composeDir, "compose.yml"),
      "-f",
      join(composeDir, "compose.local.yml"),
      "ps",
    ]);
  });

  it("defaults to the script's tailscale mode and adds dind + LocalAPI sidecar overlays", async () => {
    const context = withEnv("THEONE_DIND=1\nTHEONE_TAILSCALE_LOCALAPI=true\n")();
    const resolved = await resolveStack(context, "up");
    expect(resolved.mode).toBe("tailscale");
    expect(resolved.files.map((file) => file.split(/[\\/]/).at(-1))).toEqual([
      "compose.yml",
      "compose.tailscale.yml",
      "compose.dind.yml",
      "compose.tailscale-api-sidecar.yml",
    ]);
    expect(resolved.env.THEONE_BIND_ADDR).toBeUndefined();
  });

  it("host-tailscale reads `tailscale ip -4`, refuses wildcards and falls back for non-up commands", async () => {
    const docker = new FakeDocker().onRun((_args, file) => (file === "tailscale" ? ok("100.101.102.103\nfd7a::1\n") : undefined));
    const make = withEnv("THEONE_MODE=host-tailscale\n");
    expect((await resolveStack(make(docker.deps()), "up")).bindAddr).toBe("100.101.102.103");

    const none = new FakeDocker().onRun((_args, file) => (file === "tailscale" ? { code: 1 } : undefined));
    await expect(resolveStack(make(none.deps()), "up")).rejects.toThrow(/could not determine the host tailscale IPv4/);
    expect((await resolveStack(make(none.deps()), "down")).bindAddr).toBe("127.0.0.1");

    const wildcard = withEnv("THEONE_MODE=host-tailscale\nTHEONE_BIND_ADDR=0.0.0.0\n")();
    await expect(resolveStack(wildcard, "up")).rejects.toThrow(/every host interface/);
  });

  it("validates project, prefix and ports with the script's messages", async () => {
    await expect(resolveStack(withEnv("THEONE_COMPOSE_PROJECT=Bad\n")(), "up")).rejects.toThrow(
      "THEONE_COMPOSE_PROJECT=Bad is not a valid compose project name (lowercase letters, digits, '-' and '_')",
    );
    await expect(resolveStack(withEnv("THEONE_MODE=local\nTHEONE_VNC_HOST_PORT=0\n")(), "up")).rejects.toThrow(
      "THEONE_VNC_HOST_PORT=0 is not a TCP port",
    );
    await expect(resolveStack(withEnv("THEONE_MODE=weird\n")(), "up")).rejects.toThrow("unknown mode 'weird'");
  });

  it("rejects a missing env file as not configured", async () => {
    stack = tempStack();
    await expect(resolveStack(stack.context(), "up")).rejects.toMatchObject({ code: "not_found" });
  });

  it("writes the Claude accounts override and skips missing dirs", async () => {
    stack = tempStack();
    const work = join(stack.dir, "claude");
    const make = (text: string) => {
      const context = stack.context(new FakeDocker().deps({ platform: "linux" }), { HOME: "/nowhere", XDG_STATE_HOME: join(stack.dir, "state") });
      mkdirSync(dirname(context.envFile), { recursive: true });
      writeFileSync(context.envFile, text);
      return context;
    };
    const resolved = await resolveStack(make(`THEONE_MODE=local\nTHEONE_HOST_CLAUDE_ACCOUNTS="work=${work} personal"\n`), "up");
    const override = join(stack.dir, "state", "theone", "compose.theone.claude-accounts.yml");
    expect(resolved.files.at(-1)).toBe(override);
    expect(resolved.warnings).toEqual(["warning: Claude account 'personal' skipped: /nowhere/.claude-personal is not a directory"]);
    expect(readFileSync(override, "utf8")).toBe(claudeAccountsYaml([{ name: "work", path: work }]));
  });
});

describe("claude accounts", () => {
  it("parses names and paths like resolve_claude_accounts", () => {
    expect(parseClaudeAccounts("work, personal=/data/p", "/home/u")).toEqual([
      { name: "work", path: "/home/u/.claude-work" },
      { name: "personal", path: "/data/p" },
    ]);
    expect(() => parseClaudeAccounts("Work", "/h")).toThrow(/invalid account name/);
    expect(() => parseClaudeAccounts("a a", "/h")).toThrow(/listed twice/);
    expect(() => parseClaudeAccounts("a=rel", "/h")).toThrow(/not an absolute path/);
  });

  it("escapes YAML strings like yaml_string", () => {
    expect(yamlString('a"b\\c$d')).toBe('"a\\"b\\\\c$$d"');
  });
});
