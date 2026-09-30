import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "../..");
const gasSourceDir = path.join(projectRoot, "gas", "src");
const viewsDir = path.join(projectRoot, "gas", "src", "views");
const workbookPath = path.join(projectRoot, ".artifacts", "gtgp-workbook.json");
const outputPath = path.join(projectRoot, "preview.html");

async function listGasFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listGasFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".gs") ? [entryPath] : [];
  }));
  return nestedFiles.flat().sort((left, right) => left.localeCompare(right));
}

async function createDashboardData(workbook) {
  const context = createContext({ GTGP_WORKBOOK_DATA: workbook });
  const generatedWorkbookPath = path.join(gasSourceDir, "data", "WorkbookData.gs");
  const sourceFiles = await listGasFiles(gasSourceDir);
  if (sourceFiles.length === 0) throw new Error("Nenhum arquivo .gs foi encontrado para gerar a prévia.");

  for (const sourceFile of sourceFiles) {
    if (sourceFile === generatedWorkbookPath) continue;
    const source = await readFile(sourceFile, "utf8");
    runInContext(source, context, { filename: path.relative(projectRoot, sourceFile) });
  }

  const response = context.gtgpGetDashboardData();
  if (!response || response.ok !== true || !response.data) {
    const code = response && response.error && response.error.code;
    throw new Error("O backend Apps Script recusou o artefato da prévia" + (code ? " (" + code + ")" : "") + ".");
  }
  return response.data;
}

function previewAdapter(data) {
  const json = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return "<script>\n" +
    "(function () {\n" +
    "  window.GTGP_LOCAL_PREVIEW = true;\n" +
    "  var dashboard = " + json + ";\n" +
    "  var runner = { success: null, failure: null };\n" +
    "  runner.withSuccessHandler = function (callback) { runner.success = callback; return runner; };\n" +
    "  runner.withFailureHandler = function (callback) { runner.failure = callback; return runner; };\n" +
    "  runner.gtgpGetDashboardData = function () {\n" +
    "    window.setTimeout(function () { if (runner.success) runner.success({ ok: true, data: dashboard }); }, 90);\n" +
    "  };\n" +
    "  runner.gtgpExportDashboardXlsx = function (payload) {\n" +
    "    window.setTimeout(function () {\n" +
    "      var validIds = new Set(dashboard.people.map(function (person) { return person.id; }));\n" +
    "      var validFields = new Set(dashboard.fields.map(function (field) { return field.key; }));\n" +
    "      var valid = payload && Array.isArray(payload.ids) && Array.isArray(payload.fields)\n" +
    "        && payload.ids.every(function (id) { return validIds.has(id); })\n" +
    "        && payload.fields.every(function (key) { return validFields.has(key); });\n" +
    "      if (!valid) {\n" +
    "        if (runner.success) runner.success({ ok: false, error: { code: 'INVALID_EXPORT_SELECTION', message: 'IDs ou campos da exportação não pertencem aos dados carregados.' } });\n" +
    "        return;\n" +
    "      }\n" +
    "      if (runner.success) runner.success({ ok: true, data: { accepted: true } });\n" +
    "    }, 90);\n" +
    "  };\n" +
    "  window.google = { script: { run: runner } };\n" +
    "})();\n" +
    "</script>";
}

let workbook;
try {
  workbook = JSON.parse(await readFile(workbookPath, "utf8"));
} catch (error) {
  throw new Error("Não foi possível ler " + path.relative(projectRoot, workbookPath) + ". Execute primeiro o importador do Plano 1.", { cause: error });
}
if (typeof workbook.simulated !== "boolean") throw new Error("O artefato de origem precisa informar se os dados são simulados.");

let html = await readFile(path.join(viewsDir, "Index.html"), "utf8");
html = html.replace(/^[\t ]*<\?\s*var include = gtgpInclude;\s*\?>[\t ]*(?:\r?\n|$)/m, "");
const includePattern = /<\?!=\s*include\('([^']+)'\);\s*\?>/g;
let assembled = "";
let lastIndex = 0;
for (const match of html.matchAll(includePattern)) {
  assembled += html.slice(lastIndex, match.index);
  const includePath = match[1] + ".html";
  const filePath = path.resolve(projectRoot, "gas", includePath);
  if (!filePath.startsWith(viewsDir + path.sep)) throw new Error("Include fora de gas/src/views/: " + match[1]);
  assembled += await readFile(filePath, "utf8");
  lastIndex = match.index + match[0].length;
}
assembled += html.slice(lastIndex);
html = assembled.replace("<body>", "<body>\n" + previewAdapter(await createDashboardData(workbook)));
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, html, "utf8");
process.stdout.write("Prévia local gerada em " + path.relative(projectRoot, outputPath) + ".\n");
