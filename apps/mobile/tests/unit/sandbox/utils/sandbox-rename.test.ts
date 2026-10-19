import { LIMITS } from "@tesseract/protocol";

import { sandboxRenameError } from "@/features/sandbox/utils/sandbox-rename";

describe("sandboxRenameError", () => {
  it("accepts a name and rejects blank or long ones", () => {
    expect(sandboxRenameError(" office ")).toBeNull();
    expect(sandboxRenameError("   ")).toBe("Enter a name.");
    expect(sandboxRenameError("x".repeat(LIMITS.maxPairingNameLength + 1))).toMatch(/under/);
  });
});
