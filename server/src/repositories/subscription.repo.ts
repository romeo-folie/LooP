import { Knex } from "knex";
import { db } from "../db";
import { ISubscriptionRow } from "../types/knex-tables";

const returnCols: (keyof ISubscriptionRow)[] = [
  "subscription_id",
  "user_id",
  "endpoint",
  "public_key",
  "auth",
  "is_active",
  "created_at",
  "updated_at",
];

export interface SubscriptionsRepo {
  findByUserAndEndpoint(
    userId: number,
    endpoint: string,
    trx?: Knex.Transaction,
  ): Promise<ISubscriptionRow | null>;
  insert(
    row: Pick<ISubscriptionRow, "user_id" | "endpoint" | "public_key" | "auth">,
    trx?: Knex.Transaction,
  ): Promise<ISubscriptionRow>;
  updateById(
    subscriptionId: number,
    patch: Partial<Pick<ISubscriptionRow, "public_key" | "auth" | "is_active">>,
    trx?: Knex.Transaction,
  ): Promise<ISubscriptionRow>;
  deleteByUserAndEndpoint(
    userId: number,
    endpoint: string,
    trx?: Knex.Transaction,
  ): Promise<number>;
}

export const subscriptionsRepo: SubscriptionsRepo = {
  async findByUserAndEndpoint(userId, endpoint, trx) {
    const qb = (trx ?? db)("subscriptions");
    const row = await qb
      .where({ user_id: userId, endpoint })
      .first<ISubscriptionRow>();
    return row ?? null;
  },

  async insert(row, trx) {
    const qb = (trx ?? db)("subscriptions");
    const [ret] = await qb.insert(row).returning(returnCols as string[]);
    if (!ret) throw new Error("Failed to create subscription");
    return ret as ISubscriptionRow;
  },

  async updateById(subscriptionId, patch, trx) {
    const qb = (trx ?? db)("subscriptions");
    const [ret] = await qb
      .where({ subscription_id: subscriptionId })
      .update({ ...patch, updated_at: new Date() })
      .returning(returnCols as string[]);
    if (!ret) throw new Error("Failed to update subscription");
    return ret as ISubscriptionRow;
  },

  async deleteByUserAndEndpoint(userId, endpoint, trx) {
    const qb = (trx ?? db)("subscriptions");
    return qb.where({ user_id: userId, endpoint }).del();
  },
};
