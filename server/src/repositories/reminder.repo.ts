import { Knex } from "knex";
import { db } from "../db";
import { IReminderRow } from "../types/knex-tables";
import { IReminderInput } from "../types";

type ReminderWithMillis = Pick<
  IReminderRow,
  "reminder_id" | "problem_id" | "due_datetime" | "is_sent" | "sent_at"
> & { created_at_millis: number };

export interface RemindersRepo {
  insertOne(
    row: Pick<IReminderRow, "problem_id" | "user_id" | "due_datetime">,
    trx?: Knex.Transaction,
  ): Promise<IReminderRow>;
  bulkInsert(
    input: IReminderInput[],
    trx?: Knex.Transaction,
  ): Promise<IReminderRow[]>;
  listByProblemIdsWithMillis(
    problemIds: number[],
    trx?: Knex.Transaction,
  ): Promise<ReminderWithMillis[]>;
}

export const remindersRepo: RemindersRepo = {
  async insertOne(
    row: Pick<IReminderRow, "problem_id" | "user_id" | "due_datetime">,
    trx?: Knex.Transaction,
  ): Promise<IReminderRow> {
    const qb = (trx ?? db)("reminders");
    const [r] = await qb.insert(row).returning("*");
    return r as IReminderRow;
  },
  async bulkInsert(input, trx) {
    const baseQuery = (trx ?? db)("reminders");
    return await baseQuery.insert(input).returning("*");
  },
  async listByProblemIdsWithMillis(
    problemIds: number[],
  ): Promise<ReminderWithMillis[]> {
    if (problemIds.length === 0) return [];

    return db("reminders")
      .whereIn("problem_id", problemIds)
      .select<
        ReminderWithMillis[]
      >("reminder_id", "problem_id", "due_datetime", "is_sent", "sent_at", db.raw("(EXTRACT(EPOCH FROM created_at) * 1000)::double precision AS created_at_millis"))
      .orderBy("is_sent", "asc")
      .orderBy("due_datetime", "desc");
  },
};
