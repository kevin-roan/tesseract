import { LIMITS } from "@theone/protocol";
import { describe, expect, it } from "vitest";
import { admitFiles, bytesToBase64, draftKey, isBlocked, mimeTypeOf, promptWithAttachments, uploadIds, uploadKindOf, uploadName, type DraftAttachment } from "./attachments";

const draft = (overrides: Partial<DraftAttachment>): DraftAttachment => ({
  key: "k",
  name: "a.png",
  mimeType: "image/png",
  size: 1,
  kind: "image",
  status: "ready",
  upload: null,
  error: null,
  data: "",
  previewUrl: null,
  ...overrides,
});

describe("attachment model", () => {
  it("classifies files", () => {
    expect(uploadKindOf("image/png")).toBe("image");
    expect(uploadKindOf("audio/wav")).toBe("audio");
    expect(uploadKindOf("application/pdf")).toBe("pdf");
    expect(uploadKindOf("text/plain")).toBe("file");
    expect(mimeTypeOf(" text/plain ")).toBe("text/plain");
    expect(mimeTypeOf("")).toBe("application/octet-stream");
    expect(uploadName("   ")).toBe("file");
    expect(draftKey(2, 255, () => 0)).toBe("att-ff-2-000000");
  });

  it("admits files within size and count limits", () => {
    const big = { name: "big.bin", size: LIMITS.maxUploadBytes + 1 };
    const files = Array.from({ length: 3 }, (_, index) => ({ name: `f${index}`, size: 10 }));
    const { accepted, message } = admitFiles([big, ...files], LIMITS.maxRunAttachments - 2);
    expect(accepted.map((file) => file.name)).toEqual(["f0", "f1"]);
    expect(message).toBe("big.bin is larger than 20 MB. You can attach up to 10 files to one message.");
    expect(admitFiles(files, 0).message).toBeNull();
  });

  it("derives prompts, ids and blocking", () => {
    const upload = { id: "upl_1" } as DraftAttachment["upload"];
    expect(promptWithAttachments(" hi ", [draft({})])).toBe("hi");
    expect(promptWithAttachments("", [draft({})])).toBe("Take a look at this image.");
    expect(promptWithAttachments("", [draft({}), draft({})])).toBe("Take a look at these images.");
    expect(promptWithAttachments("", [draft({ kind: "pdf" })])).toBe("Take a look at the attached file.");
    expect(promptWithAttachments("", [draft({ kind: "pdf" }), draft({})])).toBe("Take a look at the attached files.");
    expect(uploadIds([draft({ upload }), draft({ status: "uploading", upload })])).toEqual(["upl_1"]);
    expect(isBlocked([draft({})])).toBe(false);
    expect(isBlocked([draft({ status: "error" })])).toBe(true);
    expect(bytesToBase64(new TextEncoder().encode("hi"))).toBe("aGk=");
  });
});
