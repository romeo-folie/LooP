import { Knex } from "knex";
import { db } from "../db";
import { IUserPreferencesRow, Settings } from "../types/knex-tables";
import { serializeSettingsForDb } from "../utils/db-serializers";

export interface UserPreferencesRepo {
  findByUserId(
    userId: number,
    trx?: Knex.Transaction,
  ): Promise<IUserPreferencesRow | null>;
  upsertReturningSettings(
    userId: number,
    settings: Settings,
    trx?: Knex.Transaction,
  ): Promise<Pick<IUserPreferencesRow, "settings">>;
}

export const userPreferencesRepo: UserPreferencesRepo = {
  async findByUserId(userId, trx) {
    const qb = (trx ?? db)("user_preferences");
    const row = await qb
      .where({ user_id: userId })
      .first<IUserPreferencesRow>();
    return row ?? null;
  },

  async upsertReturningSettings(userId, settings, trx) {
    const knexInstance = trx ?? db;
    const qb = knexInstance("user_preferences");
    const [ret] = await qb
      .insert({
        user_id: userId,
        settings: serializeSettingsForDb(settings, knexInstance as Knex) as
          | Settings
          | string,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
      .onConflict("user_id")
      .merge({ settings, updated_at: db.fn.now() })
      .returning<{ settings: Settings }[]>(["settings"]);

    if (!ret) throw new Error("Failed to upsert user preferences");
    return ret;
  },
};
