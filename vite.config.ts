import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

export default defineConfig({
  // The build is served from /apps/beijing-fusheng/ inside the desk and from any folder on its own.
  base: "./",
  plugins: [preact()],
  build: { outDir: "dist", emptyOutDir: true },
});
