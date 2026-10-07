import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const alias = {
  "@shared": resolve(__dirname, "src/shared"),
  "@core": resolve(__dirname, "src/core"),
  "@renderer": resolve(__dirname, "src/renderer"),
};

export default defineConfig({
  resolve: { alias },
  css: { modules: { localsConvention: "camelCaseOnly" } },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["tests/**/*.test.ts", "src/core/**/*.test.ts", "src/shared/**/*.test.ts", "src/main/**/*.test.ts", "cli/**/*.test.ts", "scripts/**/*.test.ts"],
        },
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: "web",
          environment: "happy-dom",
          include: ["src/renderer/**/*.test.{ts,tsx}"],
          setupFiles: ["src/renderer/test/setup.ts"],
          testTimeout: 30_000,
          css: { modules: { classNameStrategy: "non-scoped" } },
        },
      },
    ],
  },
});
