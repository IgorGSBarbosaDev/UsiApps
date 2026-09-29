import { strToU8, zipSync } from "fflate";
import type { Field, PersonRecord } from "./types";

const xmlText = (value: string) => value
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

function columnName(index: number): string {
  let result = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function cellXml(reference: string, value: string, key: string): string {
  if (!value) return `<c r="${reference}"/>`;
  const isNumericField = key === "idade" || key === "nota20261" || key === "nota20262" || key === "ultimanota";
  const number = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value;
  if (isNumericField && Number.isFinite(Number(number))) return `<c r="${reference}"><v>${number}</v></c>`;
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`;
}

export function buildXlsx(fields: Field[], people: PersonRecord[]): Uint8Array {
  const headerRow = `<row r="1">${fields.map((field, index) => cellXml(`${columnName(index)}1`, field.label, field.key)).join("")}</row>`;
  const rows = people.map((person, rowIndex) => {
    const rowNumber = rowIndex + 2;
    return `<row r="${rowNumber}">${fields.map((field, index) => cellXml(`${columnName(index)}${rowNumber}`, String(person.values[field.key] ?? ""), field.key)).join("")}</row>`;
  }).join("");

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Pessoas" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`),
    "xl/worksheets/sheet1.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${headerRow}${rows}</sheetData></worksheet>`),
  };

  return zipSync(files, { level: 6 });
}

export function downloadXlsx(fields: Field[], people: PersonRecord[]) {
  const zipped = buildXlsx(fields, people);
  const bytes = new Uint8Array(zipped.byteLength);
  bytes.set(zipped);
  const blob = new Blob([bytes.buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gtgp-pessoas-${new Date().toISOString().slice(0, 10)}.xlsx`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
