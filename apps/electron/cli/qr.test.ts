import { describe, expect, it } from "vitest";
import { QR } from "./constants";
import { qrMatrix, renderQr } from "./qr";

const LINK = "tesseract://pair?url=http%3A%2F%2F127.0.0.1%3A7700&token=abc";

describe("terminal QR code", () => {
  it("surrounds the code with a quiet zone", () => {
    const matrix = qrMatrix(LINK);
    expect(matrix.length).toBe(matrix[0]?.length);
    expect(matrix[0]?.every((cell) => !cell)).toBe(true);
    expect(matrix[QR.quietZone]?.[QR.quietZone]).toBe(true);
  });

  it("packs two rows per line", () => {
    const size = qrMatrix(LINK).length;
    const lines = renderQr(LINK, false);
    expect(lines.length).toBe(Math.ceil(size / 2));
    expect(lines.every((line) => [...line].length === size)).toBe(true);
  });

  it("wraps lines in light-background ANSI colours when colour is on", () => {
    const [first = ""] = renderQr(LINK, true);
    expect(first.startsWith(QR.ansiDarkOnLight)).toBe(true);
    expect(first.endsWith(QR.ansiReset)).toBe(true);
  });
});
