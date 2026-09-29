import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  root: projectRoot,
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: [
      {
        find: "@/data/synthetic-preview.json",
        replacement: path.resolve(projectRoot, mode === "preview" ? "src/data/synthetic-preview.json" : "src/data/empty-preview.json"),
      },
      { find: "@", replacement: path.resolve(projectRoot, "src") },
    ],
  },
  build: {
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      input: path.resolve(projectRoot, "index.html"),
    },
  },
}));
