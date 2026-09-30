import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requiredSheets = ["Base_Principal", "TB_Agente"];
const requiredHeaders = {
  Base_Principal: ["matricula", "nome"],
  TB_Agente: ["matricula"],
};

function normalizeKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function cellText(value) {
  return value == null ? "" : String(value);
}

function incompatible(message) {
  throw new Error(`Fonte incompatível: ${message}`);
}

function readSheet(workbook, name) {
  const worksheet = workbook.Sheets[name];
  if (!worksheet) incompatible(`a aba obrigatória "${name}" não foi encontrada.`);

  const matrix = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
  if (!matrix.length) incompatible(`a aba "${name}" não contém uma linha de cabeçalhos.`);

  const originalHeaders = matrix[0].map(cellText);
  const headers = originalHeaders.map((original) => ({
    key: normalizeKey(original),
    original,
  }));

  if (headers.some((header) => !header.key)) {
    incompatible(`a aba "${name}" contém cabeçalho vazio ou sem chave normalizada.`);
  }

  const seenKeys = new Set();
  for (const header of headers) {
    if (seenKeys.has(header.key)) {
      incompatible(`a aba "${name}" contém mais de um cabeçalho com a chave normalizada "${header.key}".`);
    }
    seenKeys.add(header.key);
  }

  const missingHeaders = requiredHeaders[name].filter((key) => !seenKeys.has(key));
  if (missingHeaders.length) {
    incompatible(`a aba "${name}" precisa conter os cabeçalhos obrigatórios: ${missingHeaders.join(", ")}.`);
  }

  const rows = [];
  for (const [index, sourceRow] of matrix.slice(1).entries()) {
    const row = sourceRow.map(cellText);
    const extraValues = row.slice(headers.length).some((value) => value.trim() !== "");
    if (extraValues) {
      incompatible(`a aba "${name}" contém dados além da última coluna com cabeçalho, na linha ${index + 2}.`);
    }
    if (!row.some((value) => value.trim() !== "")) continue;

    const normalizedRow = {};
    headers.forEach(({ key }, columnIndex) => {
      // sheet_to_json(raw:false) returns formatted cell text; identifiers never become numbers.
      normalizedRow[key] = row[columnIndex] ?? "";
    });
    rows.push(normalizedRow);
  }

  return { name, headers, rows };
}

function main() {
  const configuredSourcePath = process.env.GTGP_WORKBOOK_PATH?.trim();
  if (!configuredSourcePath) {
    throw new Error(
      "Defina GTGP_WORKBOOK_PATH com o caminho do arquivo XLSX de origem, mantido fora do repositório.",
    );
  }

  const sourcePath = resolve(configuredSourcePath);
  let sourceBytes;
  try {
    sourceBytes = readFileSync(sourcePath);
  } catch {
    throw new Error(`Arquivo indicado por GTGP_WORKBOOK_PATH não encontrado ou indisponível: ${sourcePath}`);
  }

  const workbook = XLSX.read(sourceBytes, { type: "buffer", cellDates: false });
  const missingSheets = requiredSheets.filter((name) => !workbook.SheetNames.includes(name));
  if (missingSheets.length) {
    incompatible(`faltam as abas obrigatórias: ${missingSheets.join(", ")}.`);
  }

  const data = {
    fileName: basename(sourcePath),
    hash: createHash("sha256").update(sourceBytes).digest("hex"),
    simulated: true,
    sheets: requiredSheets.map((name) => readSheet(workbook, name)),
  };

  const generatedHeader = "// AUTO-GERADO por scripts/import-workbook.mjs. Não edite manualmente.\n";
  const gasPath = resolve(projectRoot, "gas/src/data/WorkbookData.gs");
  const previewPath = resolve(projectRoot, ".artifacts/gtgp-workbook.json");
  mkdirSync(dirname(gasPath), { recursive: true });
  mkdirSync(dirname(previewPath), { recursive: true });
  writeFileSync(gasPath, `${generatedHeader}var GTGP_WORKBOOK_DATA = ${JSON.stringify(data, null, 2)};\n`, "utf8");
  writeFileSync(previewPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

  console.log("Artefatos gerados: gas/src/data/WorkbookData.gs e .artifacts/gtgp-workbook.json.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Falha ao importar o workbook.");
  process.exitCode = 1;
}
