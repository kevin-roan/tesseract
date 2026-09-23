import { expect, test } from "bun:test";
import { parseJson, parseJsonWith, TicketSchema, validate } from "../src/index";
import { sampleTicket } from "../src/fixtures";

test("validate returns typed values or a readable message", () => {
  expect(validate(TicketSchema, sampleTicket)).toEqual({ ok: true, value: sampleTicket });
  const bad = validate(TicketSchema, { ticket: "" });
  expect(bad.ok).toBe(false);
  if (!bad.ok) {
    expect(bad.error.code).toBe("invalid_payload");
    expect(bad.error.message).toContain("expiresAt");
  }
});

test("parseJson / parseJsonWith", () => {
  expect(parseJson("[1]")).toEqual({ ok: true, value: [1] });
  expect(parseJson("{").ok).toBe(false);
  expect(parseJsonWith(TicketSchema, JSON.stringify(sampleTicket))).toEqual({ ok: true, value: sampleTicket });
  const invalid = parseJsonWith(TicketSchema, "nope");
  expect(invalid.ok ? null : invalid.error.code).toBe("invalid_json");
});
