import { Knex } from "knex";
import { Logger } from "winston";
import { userPreferencesRepo } from "../repositories/user-preference.repo";
import AppError from "../types/errors";
import { Settings } from "../types/knex-tables";

type UpsertArgs = {
  userId: number;
  settings: Settings;
  log?: Logger;
  trx?: Knex.Transaction;
};

type UpsertResult = {
  settings: Settings;
  created: boolean; // true if first time, false if updated
};

type GetArgs = {
  userId: number;
  log?: Logger;
  trx?: Knex.Transaction;
};

export async function upsertUserPreferences({
  userId,
  settings,
  log,
  trx,
}: UpsertArgs): Promise<UpsertResult> {
  if (!userId) throw new AppError("UNAUTHORIZED");

  const existing = await userPreferencesRepo.findByUserId(userId, trx);
  const { settings: savedSettings } =
    await userPreferencesRepo.upsertReturningSettings(userId, settings, trx);

  const created = !existing;
  log?.info("upsertUserPreferences:success", { userId, created });

  return { settings: savedSettings, created };
}

export async function getUserPreferences({
  userId,
  log,
  trx,
}: GetArgs): Promise<Settings> {
  if (!userId) throw new AppError("UNAUTHORIZED");

  const row = await userPreferencesRepo.findByUserId(userId, trx);
  const settings = row?.settings ?? {};

  log?.info("getUserPreferences:success", { userId, hasSettings: !!row });
  return settings;
}
