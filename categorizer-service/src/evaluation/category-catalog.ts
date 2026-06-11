import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { resolve } from "path";
import {
  DEFAULT_CATEGORY_BEHAVIOR,
  DEFAULT_CATEGORY_PRICING,
  type CategoryDTO,
} from "@move/shared";

interface SeedCategoryRecord {
  id: string;
  name: string;
  descriptions: string[];
}

const CATEGORY_SEED_HEADERS = ["id", "category_name", "category_name_es", "description"] as const;

export async function loadEvaluationCategories(): Promise<CategoryDTO[]> {
  const categories = await loadSeedCategories();

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    descriptions: category.descriptions,
    pricing: DEFAULT_CATEGORY_PRICING,
    behavior: DEFAULT_CATEGORY_BEHAVIOR,
    active: true,
  }));
}

async function loadSeedCategories(): Promise<SeedCategoryRecord[]> {
  const csvPath = resolve(__dirname, "../../../reservation-service/data/categories.csv");
  const csvContent = await readFile(csvPath, "utf8");
  const rows = parseCsv(normalizeSeedCsv(csvContent));

  if (rows.length === 0) {
    throw new Error(`Category seed CSV is empty: ${csvPath}`);
  }

  const headerRow = rows[0];
  if (!headerRow) {
    throw new Error(`Category seed CSV is empty: ${csvPath}`);
  }

  const dataRows = rows.slice(1);
  const headerIndexes = getHeaderIndexes(headerRow, csvPath);
  const groupedRecords = new Map<string, SeedCategoryRecord>();

  for (const row of dataRows) {
    const sourceId = getRequiredValue(row, headerIndexes.id, "id", csvPath);
    const name = getRequiredValue(row, headerIndexes.category_name, "category_name", csvPath);
    const description = getOptionalDescription(row, headerIndexes.description);
    const id = toDeterministicUuid(sourceId);
    const existing = groupedRecords.get(id);

    if (existing) {
      if (existing.name !== name) {
        throw new Error(`Category seed CSV contains conflicting names for id ${id}`);
      }

      if (description && !existing.descriptions.includes(description)) {
        existing.descriptions.push(description);
      }
      continue;
    }

    groupedRecords.set(id, {
      id,
      name,
      descriptions: description ? [description] : [],
    });
  }

  return [...groupedRecords.values()];
}

function normalizeSeedCsv(input: string): string {
  return input
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line, index) => normalizeSeedCsvLine(line, index === 0))
    .filter((line) => line.length > 0)
    .join("\n");
}

function normalizeSeedCsvLine(line: string, isHeader: boolean): string {
  const trimmed = line.trim();
  if (!trimmed) {
    return "";
  }

  if (isHeader) {
    return trimmed.replace(/;+$/u, "");
  }

  let normalized = trimmed.replace(/;+$/u, "");

  if (normalized.startsWith('"')) {
    normalized = normalized.slice(1);
  }

  if (normalized.endsWith('"')) {
    normalized = normalized.slice(0, -1);
  }

  normalized = normalized.replace(/";"/gu, "; ");
  normalized = normalized.replace(/""/gu, '"');

  return normalized;
}

function getHeaderIndexes(
  headerRow: string[],
  csvPath: string
): Record<(typeof CATEGORY_SEED_HEADERS)[number], number> {
  const headerIndexes = {} as Record<(typeof CATEGORY_SEED_HEADERS)[number], number>;

  for (const header of CATEGORY_SEED_HEADERS) {
    const index = headerRow.findIndex((column) => column.trim() === header);
    if (index === -1) {
      throw new Error(`Category seed CSV is missing required header '${header}': ${csvPath}`);
    }

    headerIndexes[header] = index;
  }

  return headerIndexes;
}

function getRequiredValue(row: string[], index: number, field: string, csvPath: string): string {
  const value = getOptionalValue(row, index);
  if (!value) {
    throw new Error(`Category seed CSV has an empty '${field}' value: ${csvPath}`);
  }

  return value;
}

function getOptionalValue(row: string[], index: number): string {
  return (row[index] ?? "").trim();
}

function getOptionalDescription(row: string[], index: number): string {
  return row
    .slice(index)
    .join(",")
    .trim()
    .replace(/^"+/u, "")
    .replace(/"+$/u, "")
    .replace(/;"+/gu, "; ")
    .replace(/""/gu, '"');
}

function toDeterministicUuid(value: string): string {
  const hash = createHash("sha1").update(`move-category:${value}`).digest("hex");
  const uuid = hash.slice(0, 32).split("");

  uuid[12] = "5";
  uuid[16] = ["8", "9", "a", "b"][parseInt(uuid[16] ?? "0", 16) % 4] ?? "8";

  return `${uuid.slice(0, 8).join("")}-${uuid.slice(8, 12).join("")}-${uuid.slice(12, 16).join("")}-${uuid.slice(16, 20).join("")}-${uuid.slice(20, 32).join("")}`;
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (character === '"') {
      if (inQuotes && input[index + 1] === '"') {
        currentField += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && input[index + 1] === "\n") {
        index += 1;
      }

      currentRow.push(currentField);
      currentField = "";

      if (currentRow.some((field) => field.length > 0)) {
        rows.push(currentRow);
      }

      currentRow = [];
      continue;
    }

    currentField += character;
  }

  if (inQuotes) {
    throw new Error("Category seed CSV contains an unterminated quoted field");
  }

  currentRow.push(currentField);
  if (currentRow.some((field) => field.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}
