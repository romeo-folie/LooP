import type { Knex } from "knex";
import { IProblemRow, IUserPreferencesRow } from "../types/knex-tables";

export function isSqlite(knexOrClient: Knex | string): boolean {
  if (typeof knexOrClient === "string") return knexOrClient === "sqlite3";
  try {
    return (
      (knexOrClient as Knex).client &&
      (knexOrClient as Knex).client.config.client === "sqlite3"
    );
  } catch {
    return false;
  }
}

export function serializeTagsForDb(
  tags: IProblemRow["tags"],
  knex?: Knex,
): string[] | string | null {
  if (!tags) return null;
  if (knex && isSqlite(knex)) {
    // store JSON string
    return JSON.stringify(tags);
  }
  // for Postgres keep as array
  return tags;
}

export function deserializeTagsFromDb(
  raw: IProblemRow["tags"],
  knex?: Knex,
): string[] {
  if (raw == null) return [];
  if (knex && isSqlite(knex)) {
    // in SQLite tests we store JSON string
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        // fallback: maybe it's a CSV string
        return raw
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
      }
    }
    return Array.isArray(raw) ? raw : [];
  }
  // Postgres normally returns text[] -> it's already an array
  return Array.isArray(raw) ? raw : [];
}

export function serializeSettingsForDb(
  settings: Record<string, unknown> | null | undefined,
  knex?: Knex,
): string | Record<string, unknown> | null {
  if (settings == null) return null;
  if (knex && isSqlite(knex)) return JSON.stringify(settings);
  return settings;
}

export function deserializeSettingsFromDb(
  raw: IUserPreferencesRow["settings"],
  knex?: Knex,
): IUserPreferencesRow["settings"] {
  if (raw == null) return {};
  if (knex && isSqlite(knex)) {
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    return typeof raw === "object" ? raw : {};
  }
  // Postgres json/jsonb returns objects already
  return typeof raw === "object" ? raw : {};
}

export function prepareProblemForInsert(
  input: Partial<
    Pick<
      IProblemRow,
      "user_id" | "name" | "difficulty" | "tags" | "date_solved" | "notes"
    >
  >,
  knex?: Knex,
) {
  const copied = { ...input };
  // normalize tags to array (trim/lowercase) if present
  if (copied.tags && Array.isArray(copied.tags)) {
    copied.tags = copied.tags.map((t: string) => t.toLowerCase().trim());
  }
  copied.tags = serializeTagsForDb(copied.tags!, knex);
  // date_solved: ensure Date or ISO string acceptable
  if (copied.date_solved && !(copied.date_solved instanceof Date)) {
    copied.date_solved = new Date(copied.date_solved);
  }
  return copied;
}

export function normalizeProblemRowFromDb(
  row: IProblemRow | undefined,
  knex?: Knex,
): IProblemRow | undefined {
  if (!row) return row;
  const out = { ...row };
  out.tags = deserializeTagsFromDb(row.tags, knex);
  return out;
}

export function normalizeUserPreferencesRow(
  row: Pick<IUserPreferencesRow, "settings"> | undefined,
  knex?: Knex,
): Pick<IUserPreferencesRow, "settings"> {
  if (!row) return { settings: {} };
  const parsed = deserializeSettingsFromDb(row.settings, knex);
  return { settings: parsed };
}
