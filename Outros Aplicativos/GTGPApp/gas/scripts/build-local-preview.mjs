import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "../..");
const viewsDir = path.join(projectRoot, "gas", "src", "views");
const workbookPath = path.join(projectRoot, ".artifacts", "gtgp-workbook.json");
const outputPath = path.join(projectRoot, "preview.html");

function normalizeId(value) {
  return String(value ?? "").trim().replace(/\s+/g, "").toLocaleUpperCase("pt-BR");
}

function countMissing(rows) {
  return rows.filter((row) => !normalizeId(row.matricula)).length;
}

function countDuplicates(rows) {
  const seen = new Set();
  let duplicates = 0;
  for (const row of rows) {
    const id = normalizeId(row.matricula);
    if (!id) continue;
    if (seen.has(id)) duplicates += 1;
    else seen.add(id);
  }
  return duplicates;
}

function createDashboardData(workbook) {
  const base = workbook.sheets.find((sheet) => sheet.name === "Base_Principal");
  const agent = workbook.sheets.find((sheet) => sheet.name === "TB_Agente");
  if (!base || !agent) throw new Error("O artefato não contém Base_Principal e TB_Agente.");

  const fields = new Map();
  const fieldLabels = {
    dataefetivo: "Data efetiva",
    matricula: "Matrícula",
    nome: "Nome",
    descricaocargo: "Cargo",
    idade: "Idade",
    sexo: "Sexo",
    programavigente: "Programa vigente",
    statustrainee: "Status trainee",
    enquadre: "Enquadre",
    dataadmissao: "Data de admissão",
    geracaogt: "Geração GT",
    geracaogp: "Geração GP",
    tempocasa: "Tempo de casa",
    descricaoceo1: "Estrutura · nível 1",
    descricaoceo2: "Estrutura · nível 2",
    descricaoceo3: "Estrutura · nível 3",
    descricaoceo4: "Estrutura · nível 4",
    descricaoceo5: "Estrutura · nível 5",
    descricaoceo6: "Estrutura · nível 6",
    descricaoceo7: "Estrutura · nível 7",
    centrocusto: "Centro de custo",
    descricaonivel1: "Descrição do nível 1",
    nivel2: "Nível 2",
    localidade: "Localidade",
    curso: "Curso",
    instituicao: "Instituição",
    observacao: "Observação",
    vagamapeada: "Vaga mapeada",
    industrialstaff: "Industrial / Staff",
    rotacao: "Rotação",
    exestagiario: "Ex-estagiário",
    areafim: "Área final",
    nota20261: "Nota 2026.1",
    potencial20261: "Potencial 2026.1",
    etapa20262: "Etapa 2026.2",
    nota20262: "Nota 2026.2",
    potencial20262: "Potencial 2026.2",
    historicoavaliacoes: "Histórico de avaliações",
    ultimocicloavaliacao: "Último ciclo avaliado",
    ultimanota: "Última nota registrada",
    ultimopotencial: "Último potencial registrado",
  };
  for (const sheet of [base, agent]) {
    for (const header of sheet.headers) {
      if (!header.key) continue;
      const field = fields.get(header.key) ?? {
        key: header.key,
        label: fieldLabels[header.key] || header.original || header.key,
        source: [],
      };
      if (!field.source.includes(sheet.name)) field.source.push(sheet.name);
      fields.set(header.key, field);
    }
  }
  const baseRows = base.rows.map((row) => ({ ...row }));
  const agentRows = agent.rows.map((row) => ({ ...row }));
  const baseIds = new Set(baseRows.map((row) => normalizeId(row.matricula)).filter(Boolean));
  const agentIds = new Set(agentRows.map((row) => normalizeId(row.matricula)).filter(Boolean));
  const quality = {
    baseRows: baseRows.length,
    agentRows: agentRows.length,
    duplicateBaseIds: countDuplicates(baseRows),
    duplicateAgentIds: countDuplicates(agentRows),
    missingBaseIds: countMissing(baseRows),
    missingAgentIds: countMissing(agentRows),
    unmatchedBaseRows: baseRows.filter((row) => {
      const id = normalizeId(row.matricula);
      return Boolean(id) && !agentIds.has(id);
    }).length,
    unmatchedAgentRows: agentRows.filter((row) => {
      const id = normalizeId(row.matricula);
      return Boolean(id) && !baseIds.has(id);
    }).length,
    blankNames: baseRows.filter((row) => !String(row.nome ?? "").trim()).length,
  };

  const people = new Map();
  const firstBaseById = new Map();
  let serial = 0;
  baseRows.forEach((row, index) => {
    serial += 1;
    const matricula = String(row.matricula ?? "").trim();
    const normalizedId = normalizeId(matricula);
    const duplicate = Boolean(normalizedId && firstBaseById.has(normalizedId));
    const id = normalizedId && !duplicate ? "id:" + normalizedId : "base:" + (index + 2) + ":" + serial;
    const person = { id, matricula, values: { ...row }, sources: ["Base_Principal"] };
    people.set(id, person);
    if (normalizedId && !firstBaseById.has(normalizedId)) firstBaseById.set(normalizedId, person);
  });

  agentRows.forEach((row, index) => {
    const matricula = String(row.matricula ?? "").trim();
    const normalizedId = normalizeId(matricula);
    let target = normalizedId ? firstBaseById.get(normalizedId) : undefined;
    if (!target) {
      serial += 1;
      const id = normalizedId ? "agent:" + normalizedId + ":" + (index + 2) : "agent:" + (index + 2) + ":" + serial;
      target = { id, matricula, values: {}, sources: [] };
      people.set(id, target);
    }
    Object.entries(row).forEach(([key, value]) => {
      if (value !== "" && (!target.values[key] || target.values[key] === "")) target.values[key] = value;
    });
    if (!target.sources.includes("TB_Agente")) target.sources.push("TB_Agente");
  });

  return {
    source: {
      fileName: workbook.fileName,
      version: String(workbook.hash || "").toLowerCase(),
      simulated: workbook.simulated === true,
    },
    fields: [...fields.values()],
    people: [...people.values()].sort((left, right) =>
      String(left.values.nome ?? "").localeCompare(String(right.values.nome ?? ""), "pt-BR"),
    ),
    quality,
  };
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
    "        if (runner.success) runner.success({ ok: false, error: { code: 'INVALID_EXPORT_SELECTION', message: 'IDs ou campos da exportação não pertencem aos dados simulados.' } });\n" +
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
if (workbook.simulated !== true) throw new Error("A prévia local exige simulated=true no artefato de origem.");

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
html = assembled.replace("<body>", "<body>\n" + previewAdapter(createDashboardData(workbook)));
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, html, "utf8");
process.stdout.write("Prévia local gerada em " + path.relative(projectRoot, outputPath) + ".\n");
