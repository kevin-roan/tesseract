import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { availableParallelism, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { STT_PROFILES, type CreateTranscription, type SttEngineName, type SttProfile, type SttStatus, type Transcription, type UpdateStt } from "@theone/protocol";
import { badRequest, errorMessage, HttpError, unavailable } from "../core/errors";
import type { EventHub } from "../core/events";
import { resolveExecutable, run, type RunResult } from "../core/exec";
import { readRegularFile } from "../core/files";
import type { Logger } from "../core/logger";
import { nowIso } from "../core/time";
import type { Config } from "../config";
import type { Repositories } from "../db/repositories";
import type { UploadService } from "./uploads";

export type AudioInput = { path: string; name: string; mimeType: string; language: string | null };
export type EngineResult = { text: string; language: string | null; durationMs: number | null };
export type TranscriptionEngine = { name: SttEngineName; model: string; transcribe: (input: AudioInput) => Promise<EngineResult> };

export type TranscriptionOptions = {
  fetch?: (input: string, init: RequestInit) => Promise<Response>;
  which?: (bin: string) => string | null;
  timeoutMs?: number;
  cpus?: number;
};

/** How a profile runs whisper.cpp: `model` is the ggml name, `idleIo` adds `ionice -c3`. */
export type SttTuning = { model: string | null; threads: number; nice: number; idleIo: boolean };

export const TRANSCRIPTION_TIMEOUT_MS = 5 * 60 * 1000;

const LANGUAGE_PATTERN = /^[a-z]{2,3}(?:[-_][a-z0-9]{1,8})*$/;
const WAV_HEADER_BYTES = 44;
const WAV_BYTES_PER_MS = 32;
const MAX_TRANSCRIPT_JSON_BYTES = 16 * 1024 * 1024;
const ERROR_DETAIL_CHARS = 300;
const NON_SPEECH_MARKERS = /\[[A-Z][A-Z_ ]+\]/g;
const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/mp4": ".m4a",
  "audio/m4a": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/aac": ".aac",
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/wave": ".wav",
  "audio/webm": ".webm",
  "audio/ogg": ".ogg",
  "audio/flac": ".flac",
};

/** ISO-639-1 code from hints such as "en", "EN-us" or "pt_BR"; null (auto-detect) for "auto" or nothing. */
export function normalizeLanguage(input: string | undefined): string | null {
  const hint = (input ?? "").trim().toLowerCase();
  if (!hint || hint === "auto") return null;
  if (!LANGUAGE_PATTERN.test(hint)) throw badRequest(`language must be an ISO-639-1 code such as "en" (got "${hint.slice(0, 20)}")`);
  return hint.split(/[-_]/)[0] ?? null;
}

/** Providers pick the decoder from the file extension, so a name without one gets the MIME type's. */
export function audioFileName(name: string, mimeType: string): string {
  return /\.[A-Za-z0-9]{2,5}$/.test(name) ? name : `${name}${AUDIO_EXTENSIONS[mimeType] ?? ""}`;
}

export function cleanTranscript(text: string): string {
  return text.replace(NON_SPEECH_MARKERS, " ").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
}

function detail(result: RunResult<string>): string {
  const text = (result.error ?? (result.stderr.trim() || result.stdout.trim())).slice(-ERROR_DETAIL_CHARS);
  if (result.timedOut) return "timed out";
  return text || `exit code ${result.code ?? "unknown"}`;
}

type WhisperJson = { result?: { language?: unknown }; transcription?: Array<{ text?: unknown }> };

function parseWhisperJson(path: string): { text: string; language: string | null } | null {
  const file = readRegularFile(path, { maxBytes: MAX_TRANSCRIPT_JSON_BYTES });
  if (!file) return null;
  try {
    const parsed = JSON.parse(file.content) as WhisperJson;
    const segments = Array.isArray(parsed.transcription) ? parsed.transcription : [];
    const text = segments.map((segment) => (typeof segment.text === "string" ? segment.text : "")).join("");
    const language = typeof parsed.result?.language === "string" ? parsed.result.language : null;
    return { text, language };
  } catch {
    return null;
  }
}

export const STT_OFF_MESSAGE = "Speech-to-text is off (select a profile in the desktop app)";
const CGROUP_CPU_MAX = "/sys/fs/cgroup/cpu.max";

export function profileTuning(profile: SttProfile, cpus: number): SttTuning {
  switch (profile) {
    case "off":
      return { model: null, threads: 0, nice: 0, idleIo: false };
    case "eco":
      return { model: "base", threads: 2, nice: 19, idleIo: true };
    case "balanced":
      return { model: "base", threads: Math.max(2, Math.floor(cpus / 4)), nice: 10, idleIo: false };
    case "performance":
      return { model: "small", threads: Math.min(cpus, Math.max(4, Math.floor(cpus / 2))), nice: 0, idleIo: false };
  }
}

/** CPUs allowed by a cgroup v2 `cpu.max` line such as "200000 100000"; null when unlimited or unreadable. */
export function cpuQuota(cpuMax: string): number | null {
  const [quota, period] = cpuMax.trim().split(/\s+/).map(Number);
  if (quota === undefined || period === undefined || !Number.isFinite(quota) || !(period > 0)) return null;
  return Math.max(1, Math.ceil(quota / period));
}

export function visibleCpus(): number {
  const cpus = availableParallelism();
  try {
    return Math.min(cpus, cpuQuota(readFileSync(CGROUP_CPU_MAX, "utf8")) ?? cpus);
  } catch {
    return cpus;
  }
}

export function whisperModelPath(config: Config, model: string): string {
  return join(config.stt.whisperModelsDir, `ggml-${model}.bin`);
}

function modelName(path: string): string {
  let file = basename(path);
  try {
    file = basename(realpathSync(path));
  } catch {}
  return file.replace(/^ggml-/, "").replace(/\.bin$/, "");
}

/** The profile's own model, else the THEONE_WHISPER_MODEL fallback. */
function resolveModel(config: Config, model: string | null): { path: string; name: string } | null {
  if (model !== null) {
    const own = whisperModelPath(config, model);
    if (existsSync(own)) return { path: own, name: model };
  }
  const fallback = config.stt.whisperModel;
  return fallback !== null && existsSync(fallback) ? { path: fallback, name: modelName(fallback) } : null;
}

function priorityPrefix(tuning: SttTuning, which: (bin: string) => string | null): string[] {
  const prefix: string[] = [];
  const ionice = tuning.idleIo ? which("ionice") : null;
  if (ionice) prefix.push(ionice, "-c3");
  const nice = tuning.nice > 0 ? which("nice") : null;
  if (nice) prefix.push(nice, "-n", String(tuning.nice));
  return prefix;
}

export function whisperCppEngine(
  paths: { ffmpeg: string; whisper: string; model: string },
  settings: { modelName: string; threads: number; prefix: string[] },
  timeoutMs: number,
): TranscriptionEngine {
  const { prefix } = settings;
  return {
    name: "whisper.cpp",
    model: settings.modelName,
    transcribe: async (input) => {
      const dir = await mkdtemp(join(tmpdir(), "theone-stt-"));
      try {
        const wav = join(dir, "audio.wav");
        const convert = await run(
          [...prefix, paths.ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error", "-i", input.path, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "-map_metadata", "-1", "-fflags", "+bitexact", "-y", wav],
          { timeoutMs },
        );
        if (!convert.ok) throw unavailable(`ffmpeg could not convert the audio: ${detail(convert)}`);
        const base = join(dir, "transcript");
        const result = await run(
          [...prefix, paths.whisper, "-m", paths.model, "-t", String(settings.threads), "-f", wav, "-l", input.language ?? "auto", "-oj", "-of", base, "-np", "-nt"],
          { timeoutMs },
        );
        if (!result.ok) throw unavailable(`whisper.cpp failed: ${detail(result)}`);
        const parsed = parseWhisperJson(`${base}.json`) ?? { text: result.stdout, language: null };
        const samples = statSync(wav).size - WAV_HEADER_BYTES;
        return { text: parsed.text, language: parsed.language ?? input.language, durationMs: Math.max(0, Math.round(samples / WAV_BYTES_PER_MS)) };
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  };
}

type OpenAiTranscription = { text?: unknown; language?: unknown; duration?: unknown };

function redact(text: string, secret: string | null): string {
  return secret ? text.split(secret).join("***") : text;
}

function providerMessage(body: string, statusText: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown } | string; message?: unknown };
    const message = typeof parsed.error === "string" ? parsed.error : (parsed.error?.message ?? parsed.message);
    if (typeof message === "string" && message) return message;
  } catch {}
  return body.trim() || statusText;
}

async function providerError(response: Response): Promise<string> {
  return providerMessage(await response.text().catch(() => ""), response.statusText);
}

export function openAiCompatibleEngine(
  settings: { url: string; apiKey: string | null; model: string },
  fetchImpl: NonNullable<TranscriptionOptions["fetch"]>,
  timeoutMs: number,
): TranscriptionEngine {
  const endpoint = `${settings.url}/audio/transcriptions`;
  return {
    name: "openai-compatible",
    model: settings.model,
    transcribe: async (input) => {
      const form = new FormData();
      form.append("file", new Blob([await Bun.file(input.path).bytes()], { type: input.mimeType }), audioFileName(input.name, input.mimeType));
      form.append("model", settings.model);
      form.append("response_format", "verbose_json");
      if (input.language) form.append("language", input.language);
      let response: Response;
      try {
        response = await fetchImpl(endpoint, {
          method: "POST",
          headers: settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {},
          body: form,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        const reason = error instanceof Error && error.name === "TimeoutError" ? "timed out" : errorMessage(error);
        throw unavailable(`Could not reach the transcription service at ${settings.url}: ${redact(reason, settings.apiKey)}`);
      }
      if (!response.ok) {
        const message = redact(await providerError(response), settings.apiKey).slice(0, ERROR_DETAIL_CHARS);
        throw unavailable(`Transcription service returned HTTP ${response.status}: ${message}`);
      }
      const text = await response.text();
      let body: OpenAiTranscription;
      try {
        body = JSON.parse(text) as OpenAiTranscription;
      } catch {
        return { text, language: input.language, durationMs: null };
      }
      if (typeof body.text !== "string") throw unavailable("Transcription service returned no text");
      return {
        text: body.text,
        language: typeof body.language === "string" ? body.language : input.language,
        durationMs: typeof body.duration === "number" && body.duration >= 0 ? Math.round(body.duration * 1000) : null,
      };
    },
  };
}

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MIME_TYPES: Record<string, string> = {
  "audio/mp4": "audio/m4a",
  "audio/x-m4a": "audio/m4a",
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
};
const GEMINI_KEY_ERRORS = /API_KEY_INVALID|API_KEY_EXPIRED/;
export const GEMINI_KEY_MISSING = "Gemini API key is not set (save one in the mobile or desktop app, or set GEMINI_API_KEY)";

type GeminiResponse = { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>; promptFeedback?: { blockReason?: unknown } };

function geminiInstruction(language: string | null): string {
  const hint = language ? ` The speech is expected to be in the language with ISO-639-1 code "${language}".` : "";
  return (
    "Transcribe the speech in this audio verbatim. Reply with the transcript only: no commentary, labels, timestamps or quotes. " +
    `If there is no speech, reply with nothing.${hint}`
  );
}

async function geminiError(response: Response, apiKey: string): Promise<string> {
  const body = redact(await response.text().catch(() => ""), apiKey);
  const message = providerMessage(body, response.statusText).slice(0, ERROR_DETAIL_CHARS);
  const { status } = response;
  if (status === 429) return `Gemini quota exhausted or rate limited (HTTP 429): ${message}`;
  if (status === 401 || status === 403 || (status === 400 && GEMINI_KEY_ERRORS.test(body))) return `Gemini rejected the API key (HTTP ${status}): ${message}`;
  return `Gemini returned HTTP ${status}: ${message}`;
}

export function geminiEngine(
  settings: { apiKey: string; model: string },
  fetchImpl: NonNullable<TranscriptionOptions["fetch"]>,
  timeoutMs: number,
): TranscriptionEngine {
  const endpoint = `${GEMINI_API_URL}/${settings.model}:generateContent`;
  return {
    name: "gemini",
    model: settings.model,
    transcribe: async (input) => {
      const data = Buffer.from(await Bun.file(input.path).bytes()).toString("base64");
      const body = {
        contents: [{ parts: [{ inline_data: { mime_type: GEMINI_MIME_TYPES[input.mimeType] ?? input.mimeType, data } }, { text: geminiInstruction(input.language) }] }],
        generationConfig: { temperature: 0 },
      };
      let response: Response;
      try {
        response = await fetchImpl(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": settings.apiKey },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        const reason = error instanceof Error && error.name === "TimeoutError" ? "timed out" : errorMessage(error);
        throw unavailable(`Could not reach Gemini: ${redact(reason, settings.apiKey)}`);
      }
      if (!response.ok) throw unavailable(await geminiError(response, settings.apiKey));
      let parsed: GeminiResponse;
      try {
        parsed = (await response.json()) as GeminiResponse;
      } catch {
        throw unavailable("Gemini returned a response that is not JSON");
      }
      const candidate = parsed.candidates?.[0];
      if (!candidate) {
        const blocked = parsed.promptFeedback?.blockReason;
        throw unavailable(typeof blocked === "string" ? `Gemini blocked the request (${blocked})` : "Gemini returned no transcript");
      }
      const text = (candidate.content?.parts ?? []).map((part) => (typeof part.text === "string" ? part.text : "")).join("");
      return { text, language: input.language, durationMs: null };
    },
  };
}

const SETUP_HINT =
  "install whisper.cpp and ffmpeg and put a model in THEONE_WHISPER_MODELS_DIR or set THEONE_WHISPER_MODEL (THEONE_WHISPER_BIN if it is not whisper-cli), " +
  "or set THEONE_STT_URL and THEONE_STT_API_KEY for an OpenAI-compatible service";

/** Chooses the engine per request, so installing whisper.cpp or a model takes effect without a restart. */
export function selectEngine(
  config: Config,
  options: TranscriptionOptions = {},
  profile: SttProfile = config.stt.profile,
  cpus: number = options.cpus ?? visibleCpus(),
): TranscriptionEngine {
  const { stt } = config;
  const which = options.which ?? ((bin: string) => resolveExecutable(bin));
  const timeoutMs = options.timeoutMs ?? TRANSCRIPTION_TIMEOUT_MS;
  if (profile === "off") throw unavailable(STT_OFF_MESSAGE);
  if (stt.engine === "none") throw unavailable("Speech-to-text is disabled (THEONE_STT_ENGINE=none)");

  if (stt.engine === "auto" || stt.engine === "whisper.cpp") {
    const tuning = profileTuning(profile, cpus);
    const whisper = which(stt.whisperBin);
    const ffmpeg = which(config.ffmpegBin);
    const model = resolveModel(config, tuning.model);
    if (whisper && ffmpeg && model) {
      const settings = { modelName: model.name, threads: tuning.threads, prefix: priorityPrefix(tuning, which) };
      return whisperCppEngine({ ffmpeg, whisper, model: model.path }, settings, timeoutMs);
    }
    if (stt.engine === "whisper.cpp") {
      const wanted = tuning.model === null ? null : whisperModelPath(config, tuning.model);
      const missing = [
        whisper ? null : `${stt.whisperBin} (THEONE_WHISPER_BIN)`,
        ffmpeg ? null : `${config.ffmpegBin} (THEONE_FFMPEG_BIN)`,
        model ? null : `the model ${wanted} (THEONE_WHISPER_MODELS_DIR) or ${stt.whisperModel ?? "a fallback model (THEONE_WHISPER_MODEL)"}`,
      ].filter((item) => item !== null);
      throw unavailable(`whisper.cpp speech-to-text is missing ${missing.join(", ")}`);
    }
  }

  const fetchImpl = options.fetch ?? ((input: string, init: RequestInit) => fetch(input, init));
  if (stt.engine === "openai-compatible") {
    if (!stt.url) throw unavailable("THEONE_STT_ENGINE=openai-compatible needs THEONE_STT_URL (and usually THEONE_STT_API_KEY)");
    return openAiCompatibleEngine({ url: stt.url, apiKey: stt.apiKey, model: stt.model }, fetchImpl, timeoutMs);
  }
  if (stt.url && stt.apiKey) return openAiCompatibleEngine({ url: stt.url, apiKey: stt.apiKey, model: stt.model }, fetchImpl, timeoutMs);
  throw unavailable(`Speech-to-text is not configured: ${SETUP_HINT}`);
}

const PROFILE_SETTING = "stt.profile";
const GEMINI_KEY_SETTING = "stt.geminiApiKey";

const isSttProfile = (value: string | null): value is SttProfile => STT_PROFILES.includes(value as SttProfile);

/** Runs one transcription at a time (FIFO) under the selected resource profile. */
export class TranscriptionService {
  private profile: SttProfile;
  /** Saved from an app through `PUT /v1/stt`; wins over GEMINI_API_KEY. */
  private geminiKey: string | null;
  private busy = false;
  private queued = 0;
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly config: Config,
    private readonly uploads: UploadService,
    private readonly repos: Repositories,
    private readonly hub: EventHub,
    private readonly logger: Logger,
    private readonly options: TranscriptionOptions = {},
  ) {
    const stored = repos.setting(PROFILE_SETTING);
    this.profile = isSttProfile(stored) ? stored : config.stt.profile;
    this.geminiKey = repos.setting(GEMINI_KEY_SETTING) || null;
  }

  status(): SttStatus {
    const cpus = this.cpus();
    const profiles = STT_PROFILES.map((id) => {
      const { model, threads, nice } = profileTuning(id, cpus);
      return { id, model, threads, nice, available: model === null || existsSync(whisperModelPath(this.config, model)) };
    });
    let engine: TranscriptionEngine | null = null;
    let reason: string | null = null;
    try {
      engine = selectEngine(this.config, this.options, this.profile, cpus);
    } catch (error) {
      reason = errorMessage(error);
    }
    return {
      profile: this.profile,
      profiles,
      engine: engine?.name ?? null,
      ready: engine !== null,
      reason,
      model: engine?.model ?? null,
      cpus,
      busy: this.busy,
      queued: this.queued,
      gemini: {
        configured: this.geminiApiKey() !== null,
        model: this.config.stt.geminiModel,
        source: this.geminiKey ? "settings" : this.config.stt.geminiApiKey ? "env" : null,
      },
    };
  }

  update(body: UpdateStt): SttStatus {
    let changed = false;
    const at = nowIso();
    if (body.profile !== undefined) {
      changed ||= body.profile !== this.profile;
      this.profile = body.profile;
      this.repos.saveSetting(PROFILE_SETTING, body.profile, at);
      this.logger.info("speech-to-text profile set", { profile: body.profile });
    }
    if (body.geminiApiKey !== undefined) {
      changed ||= body.geminiApiKey !== this.geminiKey;
      this.geminiKey = body.geminiApiKey;
      if (body.geminiApiKey === null) this.repos.deleteSetting(GEMINI_KEY_SETTING);
      else this.repos.saveSetting(GEMINI_KEY_SETTING, body.geminiApiKey, at);
      this.logger.info(body.geminiApiKey === null ? "gemini api key removed" : "gemini api key saved");
    }
    const status = this.status();
    if (changed) this.hub.publish({ type: "stt.updated", stt: status });
    return status;
  }

  private geminiApiKey(): string | null {
    return this.geminiKey ?? this.config.stt.geminiApiKey;
  }

  async transcribe(input: CreateTranscription): Promise<Transcription> {
    const { upload, path } = this.uploads.content(input.uploadId);
    if (upload.kind !== "audio") throw badRequest(`Upload ${upload.id} is not audio (${upload.mimeType})`);
    const audio: AudioInput = { path, name: upload.name, mimeType: upload.mimeType, language: normalizeLanguage(input.language) };
    let fallbackReason: string | null = null;
    if (input.provider === "gemini") {
      const geminiApiKey = this.geminiApiKey();
      const { geminiModel } = this.config.stt;
      if (!geminiApiKey) fallbackReason = GEMINI_KEY_MISSING;
      else {
        const fetchImpl = this.options.fetch ?? ((url: string, init: RequestInit) => fetch(url, init));
        const engine = geminiEngine({ apiKey: geminiApiKey, model: geminiModel }, fetchImpl, this.options.timeoutMs ?? TRANSCRIPTION_TIMEOUT_MS);
        try {
          return await this.run(engine, upload.id, audio, null);
        } catch (error) {
          if (error instanceof HttpError && error.code === "bad_request") throw error;
          fallbackReason = errorMessage(error);
          this.logger.warn("gemini transcription failed, using the native engine", { id: upload.id, reason: fallbackReason });
        }
      }
    }
    try {
      return await this.native(upload.id, audio, fallbackReason);
    } catch (error) {
      if (fallbackReason === null || (error instanceof HttpError && error.code === "bad_request")) throw error;
      throw unavailable(`${fallbackReason}; the native engine failed too: ${errorMessage(error)}`);
    }
  }

  private async native(id: string, audio: AudioInput, fallbackReason: string | null): Promise<Transcription> {
    if (this.profile === "off") throw unavailable(STT_OFF_MESSAGE);
    selectEngine(this.config, this.options, this.profile, this.cpus());
    return this.exclusive(() => this.run(selectEngine(this.config, this.options, this.profile, this.cpus()), id, audio, fallbackReason));
  }

  private async run(engine: TranscriptionEngine, id: string, audio: AudioInput, fallbackReason: string | null): Promise<Transcription> {
    const started = Date.now();
    const result = await engine.transcribe(audio);
    const text = cleanTranscript(result.text);
    this.logger.info("audio transcribed", { id, engine: engine.name, model: engine.model, profile: this.profile, ms: Date.now() - started, chars: text.length });
    if (!text) throw badRequest("No speech detected");
    return { uploadId: id, text, language: result.language, durationMs: result.durationMs, engine: engine.name, fallbackReason };
  }

  private cpus(): number {
    return this.options.cpus ?? visibleCpus();
  }

  private async exclusive<T>(task: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release = () => {};
    this.tail = new Promise((resolve) => (release = resolve));
    this.queued += 1;
    await previous;
    this.queued -= 1;
    this.busy = true;
    try {
      return await task();
    } finally {
      this.busy = false;
      release();
    }
  }
}
