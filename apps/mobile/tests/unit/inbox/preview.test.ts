import { plainPreview } from "@/features/inbox/utils/preview";

describe("plainPreview", () => {
  it("strips Markdown syntax and collapses whitespace", () => {
    expect(plainPreview("**Cause.** `adb devices -l`\n\n- shows [the device](https://x.y)")).toBe(
      "Cause. adb devices -l shows the device",
    );
  });

  it("drops fenced code and headings", () => {
    expect(plainPreview("## Done\n```ts\nconst a = 1;\n```\nAll good")).toBe("Done All good");
  });
});
