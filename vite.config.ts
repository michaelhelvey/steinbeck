import { defineConfig, FileTypes } from "@michaelhelvey/vite-config";
import solid from "@solidjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

export default await defineConfig({
  plugins: [solid(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host ?? false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: "safari16",
    minify: process.env.TAURI_ENV_DEBUG ? false : "oxc",
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
  },
  lint: {
    rules: {
      complexity: ["error", { max: 4 }],
    },
    overrides: [
      {
        files: FileTypes.JS_SOURCE,
        rules: { "no-console": "off" },
      },
    ],
  },
});
