import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ATTACHMENT_LABELS,
  AttachmentError,
  FALLBACK_MIME_TYPE,
  MAX_NAME_LENGTH,
  formatBytes,
  maxUploadBytes,
  mimeTypeOf,
  pasteFailedMessage,
  pastedImage,
  pastedImageName,
  pickedFile,
  readAttachment,
  tooLargeMessage,
  uploadKindOf,
  uploadName,
} from ".";

let tmp: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "monolith-test-attachments-"));
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe("attachment model", () => {
  it("matches the mobile upload kinds", () => {
    expect(uploadKindOf("image/png")).toBe("image");
    expect(uploadKindOf("audio/m4a")).toBe("audio");
    expect(uploadKindOf("application/pdf")).toBe("pdf");
    expect(uploadKindOf("text/plain")).toBe("file");
  });

  it("prefers the hint, then the extension", () => {
    expect(mimeTypeOf("x.bin", "application/x-thing")).toBe("application/x-thing");
    expect(mimeTypeOf("shot.png")).toBe("image/png");
    expect(mimeTypeOf("SHOT.JPG")).toBe("image/jpeg");
    expect(mimeTypeOf("report.pdf", " ")).toBe("application/pdf");
    expect(mimeTypeOf("noext")).toBe(FALLBACK_MIME_TYPE);
    expect(mimeTypeOf(".png")).toBe(FALLBACK_MIME_TYPE);
  });

  it("trims and caps upload names and names pasted images", () => {
    expect(uploadName("  a.txt ")).toBe("a.txt");
    expect(uploadName("x".repeat(300))).toHaveLength(MAX_NAME_LENGTH);
    expect(uploadName("   ")).toBe("file");
    expect(pastedImageName(1000)).toBe("pasted-image-3e8.png");
  });

  it("formats bytes like the GTK app", () => {
    expect(formatBytes(null)).toBe("0 B");
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1024 * 1024 * 1.5)).toBe("1.5 MB");
    expect(formatBytes(20 * 1024 * 1024)).toBe("20 MB");
    expect(formatBytes(150 * 1024)).toBe("150 KB");
    expect(tooLargeMessage("big.zip")).toBe("big.zip is larger than 20 MB.");
  });
});

describe("reading files", () => {
  it("reads a file as base64 with its mime type", async () => {
    await writeFile(join(tmp, "a.txt"), "hello");
    expect(await readAttachment(join(tmp, "a.txt"))).toEqual({
      name: "a.txt",
      mimeType: "text/plain",
      size: 5,
      base64: Buffer.from("hello").toString("base64"),
    });
    expect(await pickedFile(join(tmp, "a.txt"))).toEqual({ path: join(tmp, "a.txt"), name: "a.txt", size: 5 });
  });

  it("re-checks the size when reading", async () => {
    await writeFile(join(tmp, "a.txt"), "hello");
    await expect(readAttachment(join(tmp, "a.txt"), { maxBytes: 3 })).rejects.toThrow("a.txt is larger than 3 B.");
    await expect(readAttachment(join(tmp, "missing.txt"))).rejects.toBeInstanceOf(AttachmentError);
    expect(maxUploadBytes()).toBe(20 * 1024 * 1024);
  });

  it("builds pasted images and their error text", () => {
    expect(pastedImage(Buffer.from([1, 2, 3]), 1000)).toEqual({ name: "pasted-image-3e8.png", mimeType: "image/png", size: 3, base64: "AQID" });
    expect(pasteFailedMessage(new Error("boom"))).toBe("Couldn't read Paste image: boom");
    expect(ATTACHMENT_LABELS.tooMany(10)).toBe("You can attach up to 10 files to one message.");
  });
});

describe("PathGrants", () => {
  it("lets only the picking window read a picked path, once and before it expires", async () => {
    const { PathGrants } = await import("./grants");
    let now = 0;
    const grants = new PathGrants(1000, () => now);
    grants.grant(1, ["/home/dev/a.png", "/home/dev/b.png"]);
    expect(grants.take(2, "/home/dev/a.png")).toBe(false);
    expect(grants.take(1, "/home/dev/a.png")).toBe(true);
    expect(grants.take(1, "/home/dev/a.png")).toBe(false);
    expect(grants.take(1, "/home/dev/.ssh/id_ed25519")).toBe(false);
    now = 2000;
    expect(grants.take(1, "/home/dev/b.png")).toBe(false);
    grants.grant(3, ["/x"]);
    grants.forget(3);
    expect(grants.take(3, "/x")).toBe(false);
  });
});
