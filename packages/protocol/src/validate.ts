import { z } from "zod";
import type { ParseResult } from "./url";

export type Schema<T = unknown> = z.ZodType<T>;
export type SchemaOutput<S extends z.ZodType> = z.output<S>;

export function validate<S extends z.ZodType>(schema: S, data: unknown): ParseResult<z.output<S>, "invalid_payload"> {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, error: { code: "invalid_payload", message: z.prettifyError(result.error) } };
}

export function parseJson(text: string): ParseResult<unknown, "invalid_json"> {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    return { ok: false, error: { code: "invalid_json", message: error instanceof Error ? error.message : String(error) } };
  }
}

export function parseJsonWith<S extends z.ZodType>(
  schema: S,
  text: string,
): ParseResult<z.output<S>, "invalid_json" | "invalid_payload"> {
  const json = parseJson(text);
  return json.ok ? validate(schema, json.value) : json;
}
