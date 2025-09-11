import { Knex } from "knex";
import { db } from "../db";
import { IPasswordResetTokenRow } from "../types/knex-tables";

export interface CreateOtpObj {
  user_id: number;
  otp_hash: string;
  expires_at: Date;
}

export interface PasswordResetTokensRepo {
  create(row: CreateOtpObj, trx?: Knex.Transaction): Promise<void>;
  findLatestByUserId(
    userId: number,
    trx?: Knex.Transaction,
  ): Promise<IPasswordResetTokenRow | null>;
  deleteByUserId(userId: number, trx?: Knex.Transaction): Promise<number>;
}

export const passwordResetTokensRepo: PasswordResetTokensRepo = {
  async create(row, trx) {
    const qb = (trx ?? db)("password_reset_tokens");
    await qb.insert(row);
  },
  async findLatestByUserId(userId, trx) {
    const qb = (trx ?? db)("password_reset_tokens");
    const row = await qb
      .where({ user_id: userId })
      .orderBy("created_at", "desc")
      .first<IPasswordResetTokenRow>();
    return row ?? null;
  },
  async deleteByUserId(userId, trx) {
    const qb = (trx ?? db)("password_reset_tokens");
    return qb.where({ user_id: userId }).del();
  },
};
