import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ErrorBodySchema, STT_PROFILES, SttStatusSchema, TranscriptionSchema, UploadSchema, type ServerEvent, type SttStatus, type Upload } from "@tesseract/protocol";
import { cpuQuota, profileTuning, STT_OFF_MESSAGE, type TranscriptionOptions } from "../src/services/transcriptions";
import { installFixture, makeTempDir, removeTempDirs, startTestController, waitFor, type TestController } from "./helpers";

describe("resource profiles", () => {
  test("tune threads and priority to the CPUs", () => {
    expect(profileTuning("off", 16)).toEqual({ model: null, threads: 0, nice: 0, idleIo: false });
    expect(profileTuning("eco", 16)).toEqual({ model: "base", threads: 2, nice: 19, idleIo: true });
    expect(profileTuning("balanced", 16)).toEqual({ model: "base", threads: 4, nice: 10, idleIo: false });
    expect(profileTuning("balanced", 4).threads).toBe(2);
    expect(profileTuning("performance", 16)).toEqual({ model: "small", threads: 8, nice: 0, idleIo: false });
    expect(profileTuning("performance", 6).threads).toBe(4);
    expect(profileTuning("performance", 2).threads).toBe(2);
  });

  test("read the cgroup CPU quota", () => {
    expect(cpuQuota("max 100000\n")).toBeNull();
    expect(cpuQuota("200000 100000\n")).toBe(2);
    expect(cpuQuota("150000 100000")).toBe(2);
    expect(cpuQuota("10000 100000")).toBe(1);
    expect(cpuQuota("")).toBeNull();
  });
});

describe("speech-to-text over HTTP", () => {
  let t: TestController;
  let bin: string;
  let models: string;
  let fallback: string;
  let workspace: string;
  const options: TranscriptionOptions = { cpus: 16 };

  const start = () =>
    startTestController({
      workspace,
      env: { TESSERACT_WHISPER_MODELS_DIR: models, TESSERACT_WHISPER_MODEL: fallback },
      controller: { transcription: options },
    });
  const stt = async () => SttStatusSchema.parse((await t.json("GET", "/v1/stt")).body);
  const select = (profile: string) => t.json<SttStatus>("PUT", "/v1/stt", { profile });
  const transcribe = (uploadId: string) => t.json("POST", "/v1/transcriptions", { uploadId });
  const upload = async (): Promise<Upload> =>
    UploadSchema.parse((await t.json("POST", "/v1/uploads", { name: "voice.m4a", mimeType: "audio/mp4", data: "AAAA" })).body);
  const priorityLog = () => (existsSync(join(bin, "priority.log")) ? readFileSync(join(bin, "priority.log"), "utf8") : "");

  beforeAll(async () => {
    bin = makeTempDir("stt-bin");
    const tools: Record<string, string> = {
      "whisper-cli": installFixture(bin, "fake-whisper.sh", "whisper-cli"),
      ffmpeg: installFixture(bin, "fake-ffmpeg.sh", "ffmpeg"),
      nice: installFixture(bin, "fake-priority.sh", "nice"),
      ionice: installFixture(bin, "fake-priority.sh", "ionice"),
    };
    options.which = (name) => tools[name] ?? null;
    models = makeTempDir("stt-models");
    writeFileSync(join(models, "ggml-base.bin"), "base model");
    const legacy = makeTempDir("stt-legacy");
    writeFileSync(join(legacy, "ggml-tiny.bin"), "tiny model");
    fallback = join(legacy, "ggml-model.bin");
    symlinkSync(join(legacy, "ggml-tiny.bin"), fallback);
    workspace = makeTempDir("stt-ws");
    t = await start();
  });

  afterAll(async () => {
    await t.stop();
    removeTempDirs();
  });

  test("reports the default eco profile and every profile's tuning", async () => {
    const status = await stt();
    expect(status).toEqual({
      profile: "eco",
      profiles: [
        { id: "off", model: null, threads: 0, nice: 0, available: true },
        { id: "eco", model: "base", threads: 2, nice: 19, available: true },
        { id: "balanced", model: "base", threads: 4, nice: 10, available: true },
        { id: "performance", model: "small", threads: 8, nice: 0, available: false },
      ],
      engine: "whisper.cpp",
      ready: true,
      reason: null,
      model: "base",
      cpus: 16,
      busy: false,
      queued: 0,
      gemini: { configured: false, model: "gemini-2.5-flash", source: null },
    });
    expect(status.profiles.map((profile) => profile.id)).toEqual([...STT_PROFILES]);
  });

  test("passes threads and idle priority to ffmpeg and whisper.cpp", async () => {
    const voice = await upload();
    writeFileSync(join(models, "ggml-base.bin"), "threads");
    rmSync(join(bin, "priority.log"), { force: true });
    const eco = TranscriptionSchema.parse((await transcribe(voice.id)).body);
    expect(eco).toMatchObject({ text: "threads=2 (lang=auto)", engine: "whisper.cpp" });
    const calls = priorityLog().trim().split("\n");
    expect(calls).toHaveLength(4);
    expect(calls[0]).toStartWith(`ionice -c3 ${join(bin, "nice")} -n 19 ${join(bin, "ffmpeg")} `);
    expect(calls[2]).toStartWith(`ionice -c3 ${join(bin, "nice")} -n 19 ${join(bin, "whisper-cli")} -m ${join(models, "ggml-base.bin")} -t 2 `);

    expect((await select("balanced")).body).toMatchObject({ profile: "balanced", ready: true, model: "base" });
    rmSync(join(bin, "priority.log"), { force: true });
    expect(TranscriptionSchema.parse((await transcribe(voice.id)).body).text).toBe("threads=4 (lang=auto)");
    expect(priorityLog().trim().split("\n")).toEqual([expect.stringMatching(/^nice -n 10 .*ffmpeg /), expect.stringMatching(/^nice -n 10 .*whisper-cli .* -t 4 /)]);
  });

  test("falls back to TESSERACT_WHISPER_MODEL when the profile's model is missing", async () => {
    const performance = (await select("performance")).body;
    expect(performance).toMatchObject({ profile: "performance", engine: "whisper.cpp", ready: true, model: "tiny" });
    writeFileSync(fallback, "threads");
    rmSync(join(bin, "priority.log"), { force: true });
    expect(TranscriptionSchema.parse((await transcribe((await upload()).id)).body).text).toBe("threads=8 (lang=auto)");
    expect(priorityLog()).toBe("");

    t.config.stt.whisperModel = join(models, "missing.bin");
    const unready = await stt();
    expect(unready).toMatchObject({ ready: false, engine: null, model: null });
    expect(unready.reason).toContain(`the model ${join(models, "ggml-small.bin")} (TESSERACT_WHISPER_MODELS_DIR)`);
    t.config.stt.whisperModel = fallback;

    writeFileSync(join(models, "ggml-small.bin"), "small model");
    expect((await stt()).profiles.find((profile) => profile.id === "performance")).toMatchObject({ model: "small", available: true });
    expect((await stt()).model).toBe("small");
    rmSync(join(models, "ggml-small.bin"));
  });

  test("off refuses transcriptions with 503", async () => {
    const voice = await upload();
    const off = (await select("off")).body;
    expect(off).toMatchObject({ profile: "off", engine: null, ready: false, reason: STT_OFF_MESSAGE, model: null });
    const refused = await transcribe(voice.id);
    expect(refused.status).toBe(503);
    expect(ErrorBodySchema.parse(refused.body).error).toEqual({ code: "unavailable", message: STT_OFF_MESSAGE });
  });

  test("rejects unknown profiles", async () => {
    for (const body of [{ profile: "turbo" }, {}, { profile: null }]) {
      const response = await t.json("PUT", "/v1/stt", body);
      expect(response.status).toBe(400);
    }
    expect((await t.request("PUT", "/v1/stt", "not json")).status).toBe(400);
  });

  test("announces profile changes on the event stream", async () => {
    const events: ServerEvent[] = [];
    const unsubscribe = t.controller.services.hub.subscribe((event) => events.push(event));
    await select("eco");
    await select("eco");
    unsubscribe();
    expect(events.filter((event) => event.type === "stt.updated").map((event) => event.type === "stt.updated" && event.stt.profile)).toEqual(["eco"]);
  });

  test("runs one transcription at a time and reports the queue", async () => {
    await select("eco");
    writeFileSync(join(models, "ggml-base.bin"), "slow");
    const voice = await upload();
    const pending = [transcribe(voice.id), transcribe(voice.id), transcribe(voice.id)];
    const seen = await waitFor(async () => {
      const status = await stt();
      return status.busy && status.queued === 2 ? status : null;
    });
    expect(seen).toMatchObject({ busy: true, queued: 2 });
    const results = await Promise.all(pending);
    expect(results.map((result) => result.status)).toEqual([200, 200, 200]);
    expect(await stt()).toMatchObject({ busy: false, queued: 0 });
  });

  test("keeps the chosen profile across restarts", async () => {
    await select("balanced");
    await t.stop();
    t = await start();
    expect((await stt()).profile).toBe("balanced");
  });

  test("the TESSERACT_STT_PROFILE default applies until a profile is chosen", async () => {
    const fresh = await startTestController({
      env: { TESSERACT_STT_PROFILE: "off", TESSERACT_WHISPER_MODELS_DIR: models },
      controller: { transcription: options },
    });
    try {
      expect(SttStatusSchema.parse((await fresh.json("GET", "/v1/stt")).body)).toMatchObject({ profile: "off", ready: false });
    } finally {
      await fresh.stop();
    }
  });
});
