import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2];
if (!["preview", "gas"].includes(mode)) {
  throw new Error("Informe o destino: preview ou gas.");
}

const output = path.join(root, ".artifacts", mode);
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
execFileSync(process.execPath, [
  path.join(root, "node_modules", "vite", "bin", "vite.js"),
  "build",
  "--mode",
  mode,
  "--outDir",
  output,
  "--emptyOutDir",
], { cwd: root, stdio: "inherit" });

const builtHtml = path.join(output, "index.html");
if (mode === "preview") {
  copyFileSync(builtHtml, path.join(root, "preview.html"));
} else {
  const gasFolder = path.join(root, "gas");
  mkdirSync(gasFolder, { recursive: true });
  copyFileSync(builtHtml, path.join(gasFolder, "Index.html"));
}
