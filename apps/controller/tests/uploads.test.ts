import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ErrorBodySchema, LIMITS, TranscriptionSchema, UploadSchema, type Upload } from "@theone/protocol";
import { loadConfig } from "../src/config";
import { HttpError } from "../src/core/errors";
import { EventHub } from "../src/core/events";
import { silentLogger } from "../src/core/logger";
import { openDatabase } from "../src/db/database";
import { Repositories } from "../src/db/repositories";
import { parseRange } from "../src/http/file-response";
import {
  audioFileName,
  cleanTranscript,
  GEMINI_KEY_MISSING,
  normalizeLanguage,
  selectEngine,
  STT_OFF_MESSAGE,
  TranscriptionService,
  type TranscriptionOptions,
} from "../src/services/transcriptions";
import { decodeBase64, normalizeMimeType, sanitizeFileName, uploadKind, UploadService } from "../src/services/uploads";
import { installFixture, makeTempDir, removeTempDirs, startTestController, type TestController } from "./helpers";

const b64 = (text: string | Uint8Array) => Buffer.from(text).toString("base64");

function httpCode(action: () => unknown): string | null {
  try {
    action();
  } catch (error) {
    return error instanceof HttpError ? `${error.code}: ${error.message}` : String(error);
  }
  return null;
}

async function asyncCode(action: () => Promise<unknown>): Promise<string | null> {
  try {
    await action();
  } catch (error) {
    return error instanceof HttpError ? `${error.code}: ${error.message}` : String(error);
  }
  return null;
}

describe("upload helpers", () => {
  test("decodes standard base64 with optional padding and whitespace", () => {
    expect(new TextDecoder().decode(decodeBase64("aGVsbG8=", 100))).toBe("hello");
    expect(new TextDecoder().decode(decodeBase64("aGVs\nbG8", 100))).toBe("hello");
    expect(httpCode(() => decodeBase64("aGVsbG8=", 4))).toStartWith("bad_request: File exceeds");
    expect(httpCode(() => decodeBase64("not base64!", 100))).toBe("bad_request: data must be standard base64");
    expect(httpCode(() => decodeBase64("a-_b", 100))).toBe("bad_request: data must be standard base64");
    expect(httpCode(() => decodeBase64("abcde", 100))).toBe("bad_request: data must be standard base64");
    expect(httpCode(() => decodeBase64("==", 100))).toBe("bad_request: File is empty");
  });

  test("sanitizes file names", () => {
    expect(sanitizeFileName("photo.jpg")).toBe("photo.jpg");
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\Users\\me\\report.pdf")).toBe("report.pdf");
    expect(sanitizeFileName("..hidden")).toBe("hidden");
    expect(sanitizeFileName(".env")).toBe("env");
    expect(sanitizeFileName("a\u0000b\nc.txt")).toBe("abc.txt");
    expect(sanitizeFileName("dir/")).toBe("upload");
    expect(sanitizeFileName("...")).toBe("upload");
    const long = sanitizeFileName(`${"é".repeat(300)}.m4a`);
    expect(long).toEndWith(".m4a");
    expect(new TextEncoder().encode(long).length).toBeLessThanOrEqual(200);
  });

  test("normalizes MIME types and infers the kind", () => {
    expect(normalizeMimeType(" Image/PNG ")).toBe("image/png");
    expect(normalizeMimeType("audio/mp4; codecs=mp4a.40.2")).toBe("audio/mp4");
    expect(normalizeMimeType("not a type")).toBe("application/octet-stream");
    expect(uploadKind("image/heic")).toBe("image");
    expect(uploadKind("application/pdf")).toBe("pdf");
    expect(uploadKind("audio/x-m4a")).toBe("audio");
    expect(uploadKind("text/plain")).toBe("file");
  });

  test("parses single byte ranges", () => {
    expect(parseRange(undefined, 10)).toBeNull();
    expect(parseRange("bytes=0-3", 10)).toEqual({ start: 0, end: 3 });
    expect(parseRange("bytes=4-", 10)).toEqual({ start: 4, end: 9 });
    expect(parseRange("bytes=-3", 10)).toEqual({ start: 7, end: 9 });
    expect(parseRange("bytes=5-100", 10)).toEqual({ start: 5, end: 9 });
    expect(parseRange("bytes=20-", 10)).toBe("unsatisfiable");
    expect(parseRange("bytes=0-1,4-5", 10)).toBeNull();
  });
});

describe("uploads over HTTP", () => {
  let t: TestController;

  beforeAll(async () => {
    t = await startTestController();
  });

  afterAll(async () => {
    await t.stop();
    removeTempDirs();
  });

  async function upload(body: Record<string, unknown>): Promise<Upload> {
    const { status, body: result } = await t.json("POST", "/v1/uploads", body);
    if (status !== 201) throw new Error(`upload failed: ${status} ${JSON.stringify(result)}`);
    return UploadSchema.parse(result);
  }

  test("stores the file privately and serves it back with bearer auth, a ticket or a range", async () => {
    const created = await upload({ name: "../notes/Screen Shot.png", mimeType: "image/png", data: b64("fake png bytes") });
    expect(created).toMatchObject({ name: "Screen Shot.png", mimeType: "image/png", kind: "image", sizeBytes: 14 });
    expect(created.id).toStartWith("upl_");
    expect(created.path).toBe(join(t.workspace, ".theone", "uploads", created.id, "Screen Shot.png"));
    expect(statSync(created.path).mode & 0o777).toBe(0o600);
    expect(statSync(dirname(created.path)).mode & 0o777).toBe(0o700);
    expect(statSync(join(t.workspace, ".theone", "uploads")).mode & 0o777).toBe(0o700);

    const content = await t.request("GET", `/v1/uploads/${created.id}/content`);
    expect(content.status).toBe(200);
    expect(content.headers.get("content-type")).toBe("image/png");
    expect(content.headers.get("content-disposition")).toStartWith('inline; filename="Screen Shot.png"');
    expect(content.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await content.text()).toBe("fake png bytes");

    const ticketed = await fetch(`${t.baseUrl}/v1/uploads/${created.id}/content?ticket=${await t.ticket()}`);
    expect(await ticketed.text()).toBe("fake png bytes");

    const partial = await t.request("GET", `/v1/uploads/${created.id}/content`, undefined, { Range: "bytes=5-7" });
    expect(partial.status).toBe(206);
    expect(partial.headers.get("content-range")).toBe("bytes 5-7/14");
    expect(await partial.text()).toBe("png");

    const other = await upload({ name: "data.bin", mimeType: "application/x-thing", data: b64("x") });
    const download = await t.request("GET", `/v1/uploads/${other.id}/content`);
    expect(download.headers.get("content-disposition")).toStartWith("attachment;");
  });

  test("refuses bad input, unknown ids, anonymous reads and oversized bodies", async () => {
    const invalid = await t.json("POST", "/v1/uploads", { name: "a.txt", mimeType: "text/plain", data: "***" });
    expect(invalid.status).toBe(400);
    expect(ErrorBodySchema.parse(invalid.body).error.message).toContain("base64");
    expect((await t.json("POST", "/v1/uploads", { name: "", mimeType: "text/plain", data: "eA==" })).status).toBe(400);

    expect((await t.request("GET", "/v1/uploads/upl_missing0000/content")).status).toBe(404);
    expect((await t.request("GET", "/v1/uploads/nope/content")).status).toBe(404);
    const created = await upload({ name: "a.txt", mimeType: "text/plain", data: b64("secret") });
    expect((await fetch(`${t.baseUrl}/v1/uploads/${created.id}/content`)).status).toBe(401);
    expect((await fetch(`${t.baseUrl}/v1/uploads/${created.id}/content?ticket=forged`)).status).toBe(401);

    rmSync(created.path);
    expect((await t.request("GET", `/v1/uploads/${created.id}/content`)).status).toBe(404);

    const tooLarge = "A".repeat(Math.ceil((LIMITS.maxUploadBytes + 3) / 3) * 4);
    const overLimit = await t.json("POST", "/v1/uploads", { name: "big.bin", mimeType: "application/octet-stream", data: tooLarge });
    expect(overLimit.status).toBe(400);
    expect(ErrorBodySchema.parse(overLimit.body).error.message).toContain("exceeds 20 MiB");

    const overBody = await t.request("POST", "/v1/uploads", "x".repeat(LIMITS.maxUploadBodyBytes + 1));
    expect(overBody.status).toBe(413);
    expect((await t.request("POST", "/v1/agent/runs", "x".repeat(2 * 1024 * 1024))).status).toBe(413);
  });
});

describe("UploadService", () => {
  test("prunes old uploads with their files", async () => {
    const config = loadConfig({ THEONE_WORKSPACE: makeTempDir("prune") });
    const repos = new Repositories(openDatabase(":memory:"));
    const uploads = new UploadService(config, repos, silentLogger);
    const old = await uploads.create({ name: "old.txt", mimeType: "text/plain", data: b64("old") });
    const fresh = await uploads.create({ name: "new.txt", mimeType: "text/plain", data: b64("new") });
    repos.uploads.save({ ...old, createdAt: "2020-01-01T00:00:00.000Z" });
    expect(uploads.prune()).toBe(1);
    expect(existsSync(dirname(old.path))).toBe(false);
    expect(existsSync(fresh.path)).toBe(true);
    expect(uploads.resolve([fresh.id, fresh.id])).toEqual([fresh]);
    expect(httpCode(() => uploads.resolve([fresh.id, old.id]))).toBe(`not_found: Upload ${old.id} not found`);
  });
});

describe("transcription helpers", () => {
  test("normalizes language hints", () => {
    expect(normalizeLanguage(undefined)).toBeNull();
    expect(normalizeLanguage("auto")).toBeNull();
    expect(normalizeLanguage("EN-us")).toBe("en");
    expect(normalizeLanguage("pt_BR")).toBe("pt");
    expect(httpCode(() => normalizeLanguage("--model"))).toStartWith("bad_request: language must be");
  });

  test("gives extension-less audio names the MIME type's extension and drops non-speech markers", () => {
    expect(audioFileName("voice", "audio/mp4")).toBe("voice.m4a");
    expect(audioFileName("voice.webm", "audio/mp4")).toBe("voice.webm");
    expect(audioFileName("voice", "audio/unknown")).toBe("voice");
    expect(cleanTranscript(" [BLANK_AUDIO] ")).toBe("");
    expect(cleanTranscript(" Hello  there.\n  Next line [MUSIC] ")).toBe("Hello there.\nNext line");
  });
});

describe("engine selection", () => {
  const base = (env: Record<string, string>) => loadConfig({ THEONE_WORKSPACE: "/w", THEONE_WHISPER_MODELS_DIR: "/nonexistent/models", ...env });
  const auto = { THEONE_STT_ENGINE: "auto" };
  const found = (bin: string) => `/usr/bin/${bin}`;
  const missing = () => null;

  test("auto prefers whisper.cpp, then an OpenAI-compatible service, else explains what to set", () => {
    const model = join(makeTempDir("model"), "ggml-base.bin");
    writeFileSync(model, "model");
    const remote = { ...auto, THEONE_STT_URL: "https://api.groq.com/openai/v1/", THEONE_STT_API_KEY: "sk-test" };
    expect(selectEngine(base({ THEONE_WHISPER_MODEL: model, ...remote }), { which: found }).name).toBe("whisper.cpp");
    expect(selectEngine(base({ THEONE_WHISPER_MODEL: model, ...remote }), { which: missing }).name).toBe("openai-compatible");
    expect(selectEngine(base({ THEONE_WHISPER_MODEL: "/nonexistent/model.bin", ...remote }), { which: found }).name).toBe("openai-compatible");
    const unconfigured = httpCode(() => selectEngine(base({ ...auto, THEONE_STT_URL: "https://api.openai.com/v1" }), { which: found }));
    expect(unconfigured).toStartWith("unavailable: Speech-to-text is not configured");
    expect(unconfigured).toContain("THEONE_WHISPER_MODELS_DIR");
    expect(unconfigured).toContain("THEONE_STT_API_KEY");
  });

  test("explicit engines report what is missing; none disables speech-to-text", () => {
    expect(httpCode(() => selectEngine(base({ THEONE_STT_ENGINE: "none" }), { which: found }))).toContain("THEONE_STT_ENGINE=none");
    const whisper = httpCode(() => selectEngine(base({ THEONE_STT_ENGINE: "whisper.cpp" }), { which: (bin) => (bin === "ffmpeg" ? null : found(bin)) }));
    expect(whisper).toBe(
      "unavailable: whisper.cpp speech-to-text is missing ffmpeg (THEONE_FFMPEG_BIN), the model /nonexistent/models/ggml-base.bin (THEONE_WHISPER_MODELS_DIR) or a fallback model (THEONE_WHISPER_MODEL)",
    );
    expect(httpCode(() => selectEngine(base({}), { which: found }, "off"))).toBe(`unavailable: ${STT_OFF_MESSAGE}`);
    expect(httpCode(() => selectEngine(base({ THEONE_STT_URL: "https://api.openai.com/v1", THEONE_STT_API_KEY: "sk" }), { which: found }))).toContain(
      "whisper.cpp speech-to-text is missing",
    );
    expect(httpCode(() => selectEngine(base({ THEONE_STT_ENGINE: "openai-compatible" }), { which: found }))).toContain("THEONE_STT_URL");
    expect(selectEngine(base({ THEONE_STT_ENGINE: "openai-compatible", THEONE_STT_URL: "http://127.0.0.1:9000/v1" }), { which: found }).name).toBe(
      "openai-compatible",
    );
  });

  test("config validates the STT variables", () => {
    expect(loadConfig({ THEONE_WORKSPACE: "/w" }).stt).toEqual({
      engine: "whisper.cpp",
      profile: "eco",
      whisperBin: "whisper-cli",
      whisperModelsDir: "/opt/whisper/models",
      whisperModel: null,
      url: null,
      apiKey: null,
      model: "whisper-1",
      geminiApiKey: null,
      geminiModel: "gemini-2.5-flash",
    });
    expect(base({ GEMINI_API_KEY: " AIza-key ", THEONE_GEMINI_STT_MODEL: "gemini-2.5-pro" }).stt).toMatchObject({ geminiApiKey: "AIza-key", geminiModel: "gemini-2.5-pro" });
    expect(() => base({ THEONE_GEMINI_STT_MODEL: "bad model" })).toThrow("THEONE_GEMINI_STT_MODEL");
    expect(base({ THEONE_STT_PROFILE: "performance" }).stt.profile).toBe("performance");
    expect(() => base({ THEONE_STT_PROFILE: "turbo" })).toThrow("THEONE_STT_PROFILE");
    expect(() => base({ THEONE_WHISPER_MODELS_DIR: "models" })).toThrow("THEONE_WHISPER_MODELS_DIR");
    expect(base({ THEONE_STT_URL: "https://api.openai.com/v1/" }).stt.url).toBe("https://api.openai.com/v1");
    expect(() => base({ THEONE_STT_ENGINE: "vosk" })).toThrow("THEONE_STT_ENGINE");
    expect(() => base({ THEONE_STT_URL: "ftp://x" })).toThrow("THEONE_STT_URL");
    expect(() => base({ THEONE_STT_URL: "https://user:pw@x" })).toThrow("THEONE_STT_URL");
    expect(() => base({ THEONE_WHISPER_MODEL: "models/base.bin" })).toThrow("THEONE_WHISPER_MODEL");
    expect(() => base({ THEONE_STT_MODEL: "bad model" })).toThrow("THEONE_STT_MODEL");
  });
});

type Captured = { url: string; authorization: string | null; fields: Record<string, string>; file: { name: string; type: string; text: string } | null };

describe("transcriptions over HTTP", () => {
  let t: TestController;
  let provider: ReturnType<typeof Bun.serve>;
  let reply: () => Response = () => Response.json({});
  const requests: Captured[] = [];
  const sttOptions: TranscriptionOptions = {};
  let whisper: string;
  let ffmpeg: string;
  let model: string;

  beforeAll(async () => {
    const bin = makeTempDir("stt-bin");
    whisper = installFixture(bin, "fake-whisper.sh", "whisper-cli");
    ffmpeg = installFixture(bin, "fake-ffmpeg.sh", "ffmpeg");
    model = join(bin, "ggml-test.bin");
    provider = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: async (request) => {
        const form = await request.formData();
        const fields: Record<string, string> = {};
        let file: Captured["file"] = null;
        for (const [key, value] of form.entries()) {
          if (typeof value === "string") fields[key] = value;
          else file = { name: value.name, type: value.type, text: await value.text() };
        }
        requests.push({ url: new URL(request.url).pathname, authorization: request.headers.get("authorization"), fields, file });
        return reply();
      },
    });
    t = await startTestController({
      env: { THEONE_STT_ENGINE: "auto", THEONE_STT_URL: `http://127.0.0.1:${provider.port}/openai/v1`, THEONE_STT_API_KEY: "sk-secret-key", THEONE_STT_MODEL: "whisper-large-v3" },
      controller: { transcription: sttOptions },
    });
  });

  afterAll(async () => {
    await t.stop();
    await provider.stop(true);
    removeTempDirs();
  });

  async function upload(name: string, mimeType: string, data = "audio bytes"): Promise<Upload> {
    const { body } = await t.json("POST", "/v1/uploads", { name, mimeType, data: b64(data) });
    return UploadSchema.parse(body);
  }

  const transcribe = (body: Record<string, unknown>) => t.json("POST", "/v1/transcriptions", body);

  test("posts the audio to an OpenAI-compatible service", async () => {
    sttOptions.which = () => null;
    reply = () => Response.json({ text: " Fix the login bug. ", language: "english", duration: 2.5 });
    const voice = await upload("voice", "audio/mp4");
    const { status, body } = await transcribe({ uploadId: voice.id, language: "en-GB" });
    expect(status).toBe(200);
    expect(TranscriptionSchema.parse(body)).toEqual({ uploadId: voice.id, text: "Fix the login bug.", language: "english", durationMs: 2500, engine: "openai-compatible", fallbackReason: null });
    expect(requests.at(-1)).toEqual({
      url: "/openai/v1/audio/transcriptions",
      authorization: "Bearer sk-secret-key",
      fields: { model: "whisper-large-v3", response_format: "verbose_json", language: "en" },
      file: { name: "voice.m4a", type: expect.stringMatching(/^audio\//), text: "audio bytes" },
    });

    reply = () => new Response("plain transcript", { headers: { "Content-Type": "text/plain" } });
    const plain = TranscriptionSchema.parse((await transcribe({ uploadId: voice.id })).body);
    expect(plain).toMatchObject({ text: "plain transcript", language: null, durationMs: null });
    expect(requests.at(-1)?.fields.language).toBeUndefined();
  });

  test("maps provider failures without leaking the key, and empty text to No speech detected", async () => {
    sttOptions.which = () => null;
    const voice = await upload("voice.m4a", "audio/x-m4a");
    reply = () => Response.json({ error: { message: "Incorrect API key provided: sk-secret-key" } }, { status: 401 });
    const denied = await transcribe({ uploadId: voice.id });
    expect(denied.status).toBe(503);
    const message = ErrorBodySchema.parse(denied.body).error.message;
    expect(message).toBe("Transcription service returned HTTP 401: Incorrect API key provided: ***");

    reply = () => Response.json({ text: "   " });
    const empty = await transcribe({ uploadId: voice.id });
    expect(empty.status).toBe(400);
    expect(ErrorBodySchema.parse(empty.body).error.message).toBe("No speech detected");
  });

  test("rejects non-audio and unknown uploads", async () => {
    const image = await upload("a.png", "image/png");
    const notAudio = await transcribe({ uploadId: image.id });
    expect(notAudio.status).toBe(400);
    expect(ErrorBodySchema.parse(notAudio.body).error.message).toContain("is not audio");
    expect((await transcribe({ uploadId: "upl_missing0000" })).status).toBe(404);
    expect((await transcribe({ uploadId: "nope" })).status).toBe(400);
  });

  test("runs ffmpeg and whisper.cpp locally when they are installed", async () => {
    sttOptions.which = (name) => ({ "whisper-cli": whisper, ffmpeg })[name] ?? null;
    t.config.stt.whisperModel = model;
    writeFileSync(model, "hello world");
    const voice = await upload("voice.m4a", "audio/mp4");
    const auto = TranscriptionSchema.parse((await transcribe({ uploadId: voice.id })).body);
    expect(auto).toEqual({ uploadId: voice.id, text: "hello world (lang=auto)", language: "en", durationMs: 1500, engine: "whisper.cpp", fallbackReason: null });
    const hinted = TranscriptionSchema.parse((await transcribe({ uploadId: voice.id, language: "de" })).body);
    expect(hinted).toMatchObject({ text: "hello world (lang=de)", language: "de" });

    writeFileSync(model, "silence");
    const silent = await transcribe({ uploadId: voice.id });
    expect(silent.status).toBe(400);
    expect(ErrorBodySchema.parse(silent.body).error.message).toBe("No speech detected");

    writeFileSync(model, "crash");
    const crashed = await transcribe({ uploadId: voice.id });
    expect(crashed.status).toBe(503);
    expect(ErrorBodySchema.parse(crashed.body).error.message).toContain("whisper.cpp failed: whisper: failed to load model");

    const broken = await upload("voice.bad", "audio/mp4");
    const undecodable = await transcribe({ uploadId: broken.id });
    expect(ErrorBodySchema.parse(undecodable.body).error.message).toContain("ffmpeg could not convert the audio");
  });

  test("the service surfaces unavailable engines as 503", async () => {
    const repos = new Repositories(openDatabase(":memory:"));
    const config = loadConfig({ THEONE_WORKSPACE: makeTempDir("stt-none"), THEONE_STT_ENGINE: "none" });
    const uploads = new UploadService(config, repos, silentLogger);
    const voice = await uploads.create({ name: "v.m4a", mimeType: "audio/mp4", data: b64("x") });
    const service = new TranscriptionService(config, uploads, repos, new EventHub(silentLogger), silentLogger);
    expect(await asyncCode(() => service.transcribe({ uploadId: voice.id }))).toBe("unavailable: Speech-to-text is disabled (THEONE_STT_ENGINE=none)");
  });
});

type GeminiRequest = { url: string; key: string | null; body: { contents: Array<{ parts: Array<{ inline_data?: { mime_type: string; data: string }; text?: string }> }>; generationConfig: unknown } };

describe("gemini transcriptions", () => {
  let t: TestController;
  let model: string;
  let reply: () => Response = () => Response.json({});
  const requests: GeminiRequest[] = [];
  const geminiText = (text: string) => Response.json({ candidates: [{ content: { parts: [{ text }] } }] });
  const sttOptions: TranscriptionOptions = {
    fetch: async (url, init) => {
      requests.push({ url, key: new Headers(init.headers).get("x-goog-api-key"), body: JSON.parse(String(init.body)) });
      return reply();
    },
  };

  beforeAll(async () => {
    const bin = makeTempDir("gemini-bin");
    const tools: Record<string, string> = { "whisper-cli": installFixture(bin, "fake-whisper.sh", "whisper-cli"), ffmpeg: installFixture(bin, "fake-ffmpeg.sh", "ffmpeg") };
    sttOptions.which = (name) => tools[name] ?? null;
    model = join(bin, "ggml-test.bin");
    writeFileSync(model, "native words");
    t = await startTestController({
      env: { THEONE_WHISPER_MODEL: model, GEMINI_API_KEY: "AIza-secret", THEONE_GEMINI_STT_MODEL: "gemini-test" },
      controller: { transcription: sttOptions },
    });
  });

  afterAll(async () => {
    await t.stop();
    removeTempDirs();
  });

  async function upload(): Promise<Upload> {
    const { body } = await t.json("POST", "/v1/uploads", { name: "voice.m4a", mimeType: "audio/mp4", data: b64("audio bytes") });
    return UploadSchema.parse(body);
  }

  const transcribe = (body: Record<string, unknown>) => t.json("POST", "/v1/transcriptions", body);
  const transcript = async (body: Record<string, unknown>) => TranscriptionSchema.parse((await transcribe(body)).body);

  test("sends the audio inline to Gemini and returns its transcript", async () => {
    reply = () => geminiText(" Ship the release. \n");
    const voice = await upload();
    expect(await transcript({ uploadId: voice.id, provider: "gemini", language: "en-US" })).toEqual({
      uploadId: voice.id,
      text: "Ship the release.",
      language: "en",
      durationMs: null,
      engine: "gemini",
      fallbackReason: null,
    });
    const request = requests.at(-1);
    expect(request?.url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent");
    expect(request?.key).toBe("AIza-secret");
    expect(request?.body.generationConfig).toEqual({ temperature: 0 });
    const parts = request?.body.contents[0]?.parts ?? [];
    expect(parts[0]?.inline_data).toEqual({ mime_type: "audio/m4a", data: b64("audio bytes") });
    expect(parts[1]?.text).toContain('"en"');
  });

  test("Gemini works while the native profile is off and treats empty output as no speech", async () => {
    const voice = await upload();
    await t.json("PUT", "/v1/stt", { profile: "off" });
    try {
      reply = () => geminiText("Still here");
      expect(await transcript({ uploadId: voice.id, provider: "gemini" })).toMatchObject({ text: "Still here", engine: "gemini" });
      reply = () => Response.json({ candidates: [{ content: { role: "model" }, finishReason: "STOP" }] });
      const silent = await transcribe({ uploadId: voice.id, provider: "gemini" });
      expect(silent.status).toBe(400);
      expect(ErrorBodySchema.parse(silent.body).error.message).toBe("No speech detected");

      reply = () => Response.json({ error: { code: 429, message: "Quota exceeded", status: "RESOURCE_EXHAUSTED" } }, { status: 429 });
      const both = await transcribe({ uploadId: voice.id, provider: "gemini" });
      expect(both.status).toBe(503);
      expect(ErrorBodySchema.parse(both.body).error.message).toBe(
        `Gemini quota exhausted or rate limited (HTTP 429): Quota exceeded; the native engine failed too: ${STT_OFF_MESSAGE}`,
      );
    } finally {
      await t.json("PUT", "/v1/stt", { profile: "eco" });
    }
  });

  test("falls back to the native engine with the reason when Gemini fails", async () => {
    const voice = await upload();
    reply = () => Response.json({ error: { code: 429, message: "Resource has been exhausted (e.g. check quota).", status: "RESOURCE_EXHAUSTED" } }, { status: 429 });
    expect(await transcript({ uploadId: voice.id, provider: "gemini" })).toMatchObject({
      text: "native words (lang=auto)",
      engine: "whisper.cpp",
      fallbackReason: "Gemini quota exhausted or rate limited (HTTP 429): Resource has been exhausted (e.g. check quota).",
    });

    reply = () => Response.json({ error: { code: 403, message: "Permission denied for key AIza-secret", status: "PERMISSION_DENIED" } }, { status: 403 });
    expect((await transcript({ uploadId: voice.id, provider: "gemini" })).fallbackReason).toBe("Gemini rejected the API key (HTTP 403): Permission denied for key ***");

    reply = () =>
      Response.json(
        { error: { code: 400, message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT", details: [{ reason: "API_KEY_INVALID" }] } },
        { status: 400 },
      );
    expect((await transcript({ uploadId: voice.id, provider: "gemini" })).fallbackReason).toBe(
      "Gemini rejected the API key (HTTP 400): API key not valid. Please pass a valid API key.",
    );

    reply = () => Response.json({ error: { code: 500, message: "Internal error", status: "INTERNAL" } }, { status: 500 });
    expect((await transcript({ uploadId: voice.id, provider: "gemini" })).fallbackReason).toBe("Gemini returned HTTP 500: Internal error");
  });

  test("uses the native engine without a key or without the gemini provider", async () => {
    const voice = await upload();
    const calls = requests.length;
    expect(await transcript({ uploadId: voice.id })).toMatchObject({ engine: "whisper.cpp", fallbackReason: null });
    expect(await transcript({ uploadId: voice.id, provider: "native" })).toMatchObject({ engine: "whisper.cpp", fallbackReason: null });
    t.config.stt.geminiApiKey = null;
    try {
      expect(await transcript({ uploadId: voice.id, provider: "gemini" })).toMatchObject({ engine: "whisper.cpp", fallbackReason: GEMINI_KEY_MISSING });
      expect((await t.json("GET", "/v1/stt")).body).toMatchObject({ gemini: { configured: false, model: "gemini-test" } });
    } finally {
      t.config.stt.geminiApiKey = "AIza-secret";
    }
    expect(requests.length).toBe(calls);
    expect((await t.json("GET", "/v1/stt")).body).toMatchObject({ gemini: { configured: true, model: "gemini-test" } });
  });
});
