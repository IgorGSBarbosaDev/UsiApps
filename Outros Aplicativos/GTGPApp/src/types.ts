export type SheetData = {
  name: string;
  headers: string[];
  rows: string[][];
};

export type DashboardPayload = {
  sheets: SheetData[];
  spreadsheetUrl: string;
  updatedAt: string;
  sourceLabel?: string;
};

export type Field = {
  key: string;
  label: string;
  source: string[];
};

export type PersonRecord = {
  id: string;
  matricula: string;
  values: Record<string, string>;
  sources: string[];
};

export type DataQuality = {
  baseRows: number;
  agentRows: number;
  duplicateBaseIds: number;
  duplicateAgentIds: number;
  missingBaseIds: number;
  missingAgentIds: number;
  unmatchedBaseRows: number;
  unmatchedAgentRows: number;
  blankNames: number;
};

export type AppDataset = {
  fields: Field[];
  people: PersonRecord[];
  quality: DataQuality;
  spreadsheetUrl: string;
  updatedAt: string;
  sourceLabel: string;
};
