import { execFileSync } from "node:child_process";
import { chmod, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { diffFile } from "./diff";
import { isStale, withFileLock } from "./lock";
import { SyncState, newLink, pythonJson, snapshotStem, snapshotToJson, type Snapshot } from "./state";
import { TarWriter, fileSource } from "./tar";
import { readArchive, tempDir, write } from "./testing";
import { writePushArchive } from "./push";

function hasPython(): boolean {
  try {
    execFileSync("python3", ["-I", "-c", "import tarfile, difflib, json"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const PYTHON = hasPython();
const POSIX = process.platform !== "win32";

function python(script: string, ...args: string[]): string {
  return execFileSync("python3", ["-I", "-c", script, ...args], { encoding: "utf8" });
}

let tmp: string;

beforeEach(async () => {
  tmp = await tempDir("compat");
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe("state files", () => {
  it("writes links.json byte for byte like json.dumps(indent=2)", async () => {
    const state = new SyncState(join(tmp, "state"));
    await state.saveLink(newLink({ projectId: "café", hostPath: "/home/me/Ünïcode ✓", pushedAt: "2026-10-01T11:40:02.123Z", manifest: { "src/a.ts": "ab" }, executable: [], confidential: true }));
    const written = await readFile(state.linksPath, "utf8");
    expect(written).toBe(
      `{\n  "caf\\u00e9": {\n    "hostPath": "/home/me/\\u00dcn\\u00efcode \\u2713",\n    "pushedAt": "2026-10-01T11:40:02.123Z",\n    "manifest": {\n      "src/a.ts": "ab"\n    },\n    "executable": [],\n    "confidential": true\n  }\n}\n`,
    );
    if (POSIX) expect((await import("node:fs")).statSync(state.linksPath).mode & 0o777).toBe(0o600);
  });

  it("keeps the snapshot.json key mix and omits manifest_before for old entries", () => {
    const snapshot: Snapshot = {
      id: "20261001-140312",
      projectId: "web",
      hostPath: "/abs",
      createdAt: "2026-10-01T12:03:12.345Z",
      kind: "pull",
      reverted: false,
      directory: "/x",
      entries: [
        { path: "a", before: "file", after_sha256: null, manifest_before: "m", baseline_known: true },
        { path: "b", before: "absent", after_sha256: "s", manifest_before: null, baseline_known: false },
      ],
    };
    expect(snapshotToJson(snapshot)).toEqual({
      id: "20261001-140312",
      projectId: "web",
      hostPath: "/abs",
      createdAt: "2026-10-01T12:03:12.345Z",
      entries: [
        { path: "a", before: "file", after_sha256: null, manifest_before: "m" },
        { path: "b", before: "absent", after_sha256: "s" },
      ],
      kind: "pull",
      reverted: false,
    });
    expect(snapshotStem(new Date(2026, 9, 1, 4, 3, 2))).toBe("20261001-040302");
  });

  it.runIf(PYTHON)("matches Python's json.dumps for the same data", () => {
    const data = { "é": { list: [1, "ü", null, true], empty: {}, none: [], ctrl: "\u0001\t\"\\" } };
    const expected = python("import json,sys; sys.stdout.write(json.dumps(json.loads(sys.argv[1]), indent=2) + '\\n')", JSON.stringify(data));
    expect(pythonJson(data)).toBe(expected);
  });
});

describe("locks", () => {
  it("serializes work on the same name and breaks stale locks", async () => {
    const dir = join(tmp, "locks");
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const first = withFileLock(dir, "demo", async () => {
      order.push("first:start");
      await gate;
      order.push("first:end");
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = withFileLock(dir, "demo", async () => {
      order.push("second");
    });
    await new Promise((resolve) => setTimeout(resolve, 60));
    release();
    await Promise.all([first, second]);
    expect(order).toEqual(["first:start", "first:end", "second"]);
    await writeFile(join(dir, "demo.lock"), "");
    await expect(withFileLock(dir, "demo", async () => "ok")).resolves.toBe("ok");
    await writeFile(join(dir, "demo.lock"), JSON.stringify({ pid: 2 ** 22 + 12345, startedAt: "", token: "dead" }));
    await expect(withFileLock(dir, "demo", async () => "ok")).resolves.toBe("ok");
  });
});

describe("stale locks", () => {
  const hour = 60 * 60 * 1000;
  const now = Date.parse("2026-10-07T12:00:00.000Z");

  it("treats a live pid as stale when the lock predates the boot or is very old", () => {
    const owner = (startedAt: string) => ({ pid: process.pid, startedAt, token: "t" });
    expect(isStale(owner(new Date(now - hour).toISOString()), now, now - 2 * hour)).toBe(false);
    expect(isStale(owner(new Date(now - 3 * hour).toISOString()), now, now - 2 * hour)).toBe(true);
    expect(isStale(owner(new Date(now - 48 * hour).toISOString()), now, now - 72 * hour)).toBe(true);
    expect(isStale(owner(""), now, now)).toBe(false);
    expect(isStale({ pid: 2 ** 22 + 12345, startedAt: "", token: "t" }, now, now)).toBe(true);
  });

  it("breaks a lock left before the last boot by a pid that is alive again", async () => {
    const dir = join(tmp, "boot-locks");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "demo.lock"), JSON.stringify({ pid: process.pid, startedAt: "2000-01-01T00:00:00.000Z", token: "old" }));
    await expect(withFileLock(dir, "demo", async () => "ok")).resolves.toBe("ok");
    expect(await readdir(dir)).toEqual([]);
  });
});

describe("portable tar modes", () => {
  it("uses 0644/0755 from the executable set instead of the file system modes", async () => {
    const root = join(tmp, "portable");
    await write(root, "gradlew", "#!/bin/sh\n");
    await write(root, "src/a.ts", "a");
    await chmod(join(root, "src/a.ts"), 0o666);
    const archive = join(tmp, "portable.tar.gz");
    const writer = new TarWriter(archive, new Set(["gradlew"]), true);
    await writer.addPath(join(root, "gradlew"), "gradlew");
    await writer.addPath(join(root, "src"), "src", true);
    await writer.close();
    const { members } = await readArchive(fileSource(archive));
    expect(members.get("gradlew")?.mode).toBe(0o755);
    expect(members.get("src/a.ts")?.mode).toBe(0o644);
    expect(members.get("src")?.mode).toBe(0o755);
  });
});

describe.runIf(PYTHON && POSIX)("tar interop with Python tarfile", () => {
  it("writes archives Python reads with modes, symlinks and long names", async () => {
    const root = join(tmp, "root");
    const long = `${"deep/".repeat(30)}file-ü.txt`;
    await write(root, "run.sh", "#!/bin/sh\n");
    await chmod(join(root, "run.sh"), 0o755);
    await write(root, long, "long");
    await symlink("run.sh", join(root, "link"));
    await write(root, ".git/HEAD", "ref");
    await chmod(join(root, long), 0o644);
    await chmod(join(root, ".git/HEAD"), 0o644);
    await chmod(join(root, ".git"), 0o755);
    const archive = join(tmp, "out.tar.gz");
    expect(await writePushArchive(root, ["run.sh", long, "link", ".git"], archive)).toBe(4);
    const listing = JSON.parse(
      python(
        "import json,sys,tarfile\nwith tarfile.open(sys.argv[1],'r:*') as t:\n print(json.dumps([[m.name,m.type.decode(),m.mode,m.linkname,(t.extractfile(m).read().decode() if m.isreg() else None)] for m in t]))",
        archive,
      ),
    ) as [string, string, number, string, string | null][];
    expect(listing).toEqual([
      ["run.sh", "0", 0o755, "", "#!/bin/sh\n"],
      [long, "0", 0o644, "", "long"],
      ["link", "2", expect.any(Number), "run.sh", null],
      [".git", "5", 0o755, "", null],
      [".git/HEAD", "0", 0o644, "", "ref"],
    ]);
  });

  it("reads archives written by Python tarfile", async () => {
    const archive = join(tmp, "py.tar.gz");
    const long = `${"x".repeat(150)}/é.txt`;
    python(
      "import io,sys,tarfile\nwith tarfile.open(sys.argv[1],'w:gz') as t:\n for name,data in [(sys.argv[2],b'long'),('./a.txt',b'a')]:\n  i=tarfile.TarInfo(name); i.size=len(data); i.mode=0o750; t.addfile(i,io.BytesIO(data))\n i=tarfile.TarInfo('l'); i.type=tarfile.SYMTYPE; i.linkname='a.txt'; t.addfile(i)\n i=tarfile.TarInfo('d'); i.type=tarfile.DIRTYPE; t.addfile(i)",
      archive,
      long,
    );
    const { members, contents } = await readArchive(fileSource(archive));
    expect([...members.keys()]).toEqual([long, "./a.txt", "l", "d"]);
    expect(contents.get(long)?.toString()).toBe("long");
    expect(members.get("./a.txt")?.mode).toBe(0o750);
    expect(members.get("l")?.linkname).toBe("a.txt");
    expect(members.get("d")?.isDirectory).toBe(true);
  });

  it("produces the same hunks as difflib", () => {
    const before = "a\nb\nc\nd\ne\nf\ng\nh\ni\nj\nk\nl\n";
    const after = "a\nB\nc\nd\ne\nf\ng\nh\nI\nj\nk\nl\nm\n";
    const expected = python(
      "import difflib,sys\na=sys.argv[1].splitlines(True); b=sys.argv[2].splitlines(True)\nfor g in difflib.SequenceMatcher(None,a,b,autojunk=False).get_grouped_opcodes(3):\n f,l=g[0],g[-1]; print(f'@@ -{f[1]+1},{l[2]-f[1]} +{f[3]+1},{l[4]-f[3]} @@')",
      before,
      after,
    );
    const hunks = diffFile(Buffer.from(before), Buffer.from(after)).lines.filter((line) => line.kind === "hunk").map((line) => line.text);
    expect(hunks.join("\n")).toBe(expected.trim());
  });
});
