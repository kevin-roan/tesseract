import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";
import { RENDERER_DEV_HOST, RENDERER_DEV_PORT } from "./src/shared/runtime";

const alias = {
  "@shared": resolve(__dirname, "src/shared"),
  "@core": resolve(__dirname, "src/core"),
};

const rendererServer = { host: RENDERER_DEV_HOST, port: RENDERER_DEV_PORT, strictPort: true };

export default defineConfig({
  main: {
    resolve: { alias },
    build: {
      externalizeDeps: false,
      rollupOptions: { input: { index: resolve(__dirname, "src/main/index.ts") } },
    },
  },
  preload: {
    resolve: { alias },
    build: {
      externalizeDeps: false,
      rollupOptions: {
        input: { index: resolve(__dirname, "src/preload/index.ts") },
        output: { format: "cjs", entryFileNames: "[name].cjs" },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    resolve: { alias: { ...alias, "@renderer": resolve(__dirname, "src/renderer") } },
    plugins: [react()],
    server: rendererServer,
    preview: rendererServer,
    css: { modules: { localsConvention: "camelCaseOnly" } },
    build: {
      rollupOptions: { input: { index: resolve(__dirname, "src/renderer/index.html") } },
    },
  },
});
