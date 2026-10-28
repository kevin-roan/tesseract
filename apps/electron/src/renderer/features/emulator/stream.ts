import { ANDROID_STREAM_ENCODINGS, type AndroidStreamEncoding, type UpdateIosStream } from "@tesseract/protocol";
import type { ChoiceOption } from "../../components/ChoiceDropdown";
import type { SegmentOption } from "../../components/SegmentedControl";
import { STREAM_AUTO_SIZE, STREAM_BITS_PER_MBIT, STREAM_MAX_SIZES, STREAM_RANGES } from "./constants";
import { STREAM_LABELS as L } from "./labels";
import type { StreamField, StreamSettings } from "./types";

export type StreamDraft = Record<StreamField, string> & { encoding: AndroidStreamEncoding; maxSize: string };
export type StreamErrors = Partial<Record<StreamField, string>>;
export type StreamParse = { ok: true; settings: StreamSettings } | { ok: false; errors: StreamErrors };

const FIELD_LABELS: Record<StreamField, string> = {
  bitRate: L.bitRate,
  maxFps: L.maxFps,
  keyFrameInterval: L.keyFrameInterval,
  jpegQuality: L.jpegQuality,
};

export const maxSizeId = (size: number | null): string => (size === null ? STREAM_AUTO_SIZE : String(size));

export const maxSizeValue = (id: string): number | null => (id === STREAM_AUTO_SIZE ? null : Number(id));

export function streamDraft(settings: StreamSettings): StreamDraft {
  return {
    encoding: settings.encoding,
    bitRate: String(settings.bitRate / STREAM_BITS_PER_MBIT),
    maxFps: String(settings.maxFps),
    maxSize: maxSizeId(settings.maxSize),
    keyFrameInterval: String(settings.keyFrameInterval),
    jpegQuality: String(settings.jpegQuality),
  };
}

export function encodingOptions(): SegmentOption<AndroidStreamEncoding>[] {
  return ANDROID_STREAM_ENCODINGS.map((id) => ({ id, label: L.encodings[id] }));
}

/** Auto plus the preset sizes, and the saved size when it is not a preset. */
export function maxSizeOptions(saved: number | null): ChoiceOption[] {
  const presets: readonly number[] = STREAM_MAX_SIZES;
  const sizes = saved === null || presets.includes(saved) ? presets : [...presets, saved].sort((a, b) => a - b);
  return [{ id: STREAM_AUTO_SIZE, label: L.sizeAuto }, ...sizes.map((size) => ({ id: String(size), label: L.sizePx(size) }))];
}

export function parseStreamDraft(draft: StreamDraft): StreamParse {
  const errors: StreamErrors = {};
  const read = (field: StreamField): number => {
    const text = draft[field].trim();
    const value = Number(text);
    const range = STREAM_RANGES[field];
    const whole = field === "bitRate" || Number.isInteger(value);
    if (!text || !Number.isFinite(value) || !whole || value < range.min || value > range.max) {
      errors[field] = L.invalid(FIELD_LABELS[field], range.min, range.max);
    }
    return value;
  };
  const settings: StreamSettings = {
    encoding: draft.encoding,
    bitRate: Math.round(read("bitRate") * STREAM_BITS_PER_MBIT),
    maxFps: read("maxFps"),
    maxSize: maxSizeValue(draft.maxSize),
    keyFrameInterval: read("keyFrameInterval"),
    jpegQuality: read("jpegQuality"),
  };
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, settings };
}

/** The fields of `next` that differ from `saved`, as a `PUT /v1/{android,ios}/stream` body. */
export function streamChanges(saved: StreamSettings, next: StreamSettings): UpdateIosStream {
  return Object.fromEntries(Object.entries(next).filter(([key, value]) => saved[key as keyof StreamSettings] !== value)) as UpdateIosStream;
}
