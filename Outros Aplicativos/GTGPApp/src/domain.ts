import type { AppDataset, DashboardPayload, DataQuality, Field, PersonRecord, SheetData } from "./types";

export const FIELD = {
  id: "matricula",
  name: "nome",
  job: "descricaocargo",
  program: "programavigente",
  status: "statustrainee",
  enquadre: "enquadre",
  location: "localidade",
  generationGt: "geracaogt",
  generationGp: "geracaogp",
  area: "areafim",
  score1: "nota20261",
  potential1: "potencial20261",
  stage2: "etapa20262",
  score2: "nota20262",
  potential2: "potencial20262",
  history: "historicoavaliacoes",
  latestCycle: "ultimocicloavaliacao",
  latestScore: "ultimanota",
  latestPotential: "ultimopotencial",
  industrialStaff: "industrialstaff",
  admissionDate: "dataadmissao",
} as const;

export const FIELD_LABELS: Record<string, string> = {
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

export function normalizeKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function cleanId(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, "").toLocaleUpperCase("pt-BR");
}

export function numberValue(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function rowsFor(sheet: SheetData | undefined): Array<Record<string, string>> {
  if (!sheet) return [];
  return sheet.rows
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
    .map((row) => Object.fromEntries(sheet.headers.map((header, index) => [
      normalizeKey(header),
      String(row[index] ?? "").trim(),
    ])));
}

function duplicateCount(rows: Array<Record<string, string>>): number {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const row of rows) {
    const id = cleanId(row[FIELD.id]);
    if (!id) continue;
    if (seen.has(id)) duplicates += 1;
    else seen.add(id);
  }
  return duplicates;
}

function missingIdCount(rows: Array<Record<string, string>>): number {
  return rows.filter((row) => !cleanId(row[FIELD.id])).length;
}

function makeFields(base?: SheetData, agent?: SheetData): Field[] {
  const fields = new Map<string, Field>();
  for (const sheet of [base, agent]) {
    if (!sheet) continue;
    for (const header of sheet.headers) {
      const key = normalizeKey(header);
      if (!key) continue;
      const field = fields.get(key) ?? {
        key,
        label: FIELD_LABELS[key] ?? header,
        source: [],
      };
      if (!field.source.includes(sheet.name)) field.source.push(sheet.name);
      fields.set(key, field);
    }
  }
  return [...fields.values()];
}

export function createDataset(payload: DashboardPayload): AppDataset {
  const baseSheet = payload.sheets.find((sheet) => sheet.name === "Base_Principal");
  const agentSheet = payload.sheets.find((sheet) => sheet.name === "TB_Agente");
  const baseRows = rowsFor(baseSheet);
  const agentRows = rowsFor(agentSheet);
  const baseIds = new Set(baseRows.map((row) => cleanId(row[FIELD.id])).filter(Boolean));
  const agentIds = new Set(agentRows.map((row) => cleanId(row[FIELD.id])).filter(Boolean));
  const quality: DataQuality = {
    baseRows: baseRows.length,
    agentRows: agentRows.length,
    duplicateBaseIds: duplicateCount(baseRows),
    duplicateAgentIds: duplicateCount(agentRows),
    missingBaseIds: missingIdCount(baseRows),
    missingAgentIds: missingIdCount(agentRows),
    unmatchedBaseRows: baseRows.filter((row) => {
      const id = cleanId(row[FIELD.id]);
      return Boolean(id) && !agentIds.has(id);
    }).length,
    unmatchedAgentRows: agentRows.filter((row) => {
      const id = cleanId(row[FIELD.id]);
      return Boolean(id) && !baseIds.has(id);
    }).length,
    blankNames: baseRows.filter((row) => !String(row[FIELD.name] ?? "").trim()).length,
  };

  const records = new Map<string, PersonRecord>();
  const firstBaseById = new Map<string, PersonRecord>();
  let serial = 0;

  baseRows.forEach((row, index) => {
    serial += 1;
    const matricula = String(row[FIELD.id] ?? "").trim();
    const normalizedId = cleanId(matricula);
    const duplicate = Boolean(normalizedId && firstBaseById.has(normalizedId));
    const id = normalizedId && !duplicate
      ? `id:${normalizedId}`
      : `base:${index + 2}:${serial}`;
    const person: PersonRecord = {
      id,
      matricula,
      values: { ...row },
      sources: ["Base_Principal"],
    };
    records.set(id, person);
    if (normalizedId && !firstBaseById.has(normalizedId)) firstBaseById.set(normalizedId, person);
  });

  agentRows.forEach((row, index) => {
    const matricula = String(row[FIELD.id] ?? "").trim();
    const normalizedId = cleanId(matricula);
    let target = normalizedId ? firstBaseById.get(normalizedId) : undefined;
    if (!target) {
      serial += 1;
      const id = normalizedId ? `agent:${normalizedId}:${index + 2}` : `agent:${index + 2}:${serial}`;
      target = {
        id,
        matricula,
        values: {},
        sources: [],
      };
      records.set(id, target);
    }
    Object.entries(row).forEach(([key, value]) => {
      if (value !== "" && (!target.values[key] || target.values[key] === "")) target!.values[key] = value;
    });
    if (!target.sources.includes("TB_Agente")) target.sources.push("TB_Agente");
  });

  const people = [...records.values()].sort((left, right) =>
    String(left.values[FIELD.name] ?? "").localeCompare(String(right.values[FIELD.name] ?? ""), "pt-BR")
  );

  return {
    fields: makeFields(baseSheet, agentSheet),
    people,
    quality,
    spreadsheetUrl: payload.spreadsheetUrl,
    updatedAt: payload.updatedAt,
    sourceLabel: payload.sourceLabel ?? "Planilha conectada",
  };
}

export function valueFor(person: PersonRecord, key: string): string {
  return String(person.values[key] ?? "").trim();
}

export function uniqueValues(people: PersonRecord[], key: string): string[] {
  return [...new Set(people.map((person) => valueFor(person, key)).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "pt-BR", { numeric: true }));
}

export function groupCount(people: PersonRecord[], key: string, emptyLabel = "Sem preenchimento") {
  const counts = new Map<string, number>();
  for (const person of people) {
    const value = valueFor(person, key) || emptyLabel;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
}

export function fieldGroups(fields: Field[]): Array<{ label: string; fields: Field[] }> {
  const groupFor = (key: string) => {
    if ([FIELD.score1, FIELD.potential1, FIELD.stage2, FIELD.score2, FIELD.potential2, FIELD.history, FIELD.latestCycle, FIELD.latestScore, FIELD.latestPotential].includes(key as never)) return "Avaliações";
    if (["descricaoceo1", "descricaoceo2", "descricaoceo3", "descricaoceo4", "descricaoceo5", "descricaoceo6", "descricaoceo7", "centrocusto", "descricaonivel1", "nivel2", "areafim", "vagamapeada", "industrialstaff", "rotacao"].includes(key)) return "Estrutura e trajetória";
    if (["curso", "instituicao", "exestagiario"].includes(key)) return "Formação";
    return "Cadastro";
  };
  const labels = ["Cadastro", "Estrutura e trajetória", "Formação", "Avaliações"];
  return labels.map((label) => ({ label, fields: fields.filter((field) => groupFor(field.key) === label) })).filter((group) => group.fields.length > 0);
}
