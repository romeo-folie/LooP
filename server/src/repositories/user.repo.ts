import { Knex } from "knex";
import { db } from "../db";
import { IUserRow } from "../types/knex-tables";

export type PublicUser = Pick<
  IUserRow,
  "user_id" | "name" | "email" | "created_at"
>;

const returnCols: (keyof IUserRow)[] = [
  "user_id",
  "name",
  "email",
  "created_at",
];

export interface UsersRepo {
  findByEmail(email: string, trx?: Knex.Transaction): Promise<IUserRow | null>;
  findPublicUserById(
    userId: number,
    trx?: Knex.Transaction,
  ): Promise<PublicUser | null>;
  insertUser(
    data: Pick<IUserRow, "name" | "email" | "password"> &
      Partial<Pick<IUserRow, "provider" | "provider_id">>,
    trx?: Knex.Transaction,
  ): Promise<IUserRow>;
  updateProviderFields(
    userId: number,
    provider: string,
    providerId: string,
    trx?: Knex.Transaction,
  ): Promise<void>;
  updatePasswordByIdAndEmail(
    userId: number,
    email: string,
    passwordHash: string,
    trx?: Knex.Transaction,
  ): Promise<number>;
}

export const usersRepo: UsersRepo = {
  async findByEmail(email, trx) {
    const qb = (trx ?? db)("users");
    return (await qb.where({ email }).first<IUserRow>()) ?? null;
  },
  async findPublicUserById(userId, trx) {
    const qb = (trx ?? db)("users");
    const row = await qb
      .select(["user_id", "name", "email", "created_at"] as const)
      .where({ user_id: userId })
      .first<PublicUser>();
    return row ?? null;
  },
  async insertUser(data, trx) {
    const qb = (trx ?? db)("users");
    const [row] = await qb.insert(data).returning(returnCols as string[]);
    if (!row) throw new Error("Failed to insert user");
    return row as IUserRow;
  },
  async updateProviderFields(userId, provider, providerId, trx) {
    const qb = (trx ?? db)("users");
    await qb.where({ user_id: userId }).update({
      provider,
      provider_id: providerId,
      updated_at: new Date(),
    });
  },
  async updatePasswordByIdAndEmail(userId, email, passwordHash, trx) {
    const qb = (trx ?? db)("users");
    const updated = await qb
      .where({ user_id: userId, email })
      .update({ password: passwordHash, updated_at: new Date() });
    return updated; // number of rows affected
  },
};
