import { Knex } from "knex";
import { db } from "../db";
import { IReminderRow } from "../types/knex-tables";
import { IReminderInput } from "../types";

const returnCols: (keyof IReminderRow)[] = [
  "reminder_id",
  "problem_id",
  "user_id",
  "due_datetime",
  "is_sent",
  "sent_at",
  "is_completed",
  "completed_at",
  "created_at",
  "updated_at",
];

type ReminderWithMillis = Pick<
  IReminderRow,
  "reminder_id" | "problem_id" | "due_datetime" | "is_sent" | "sent_at"
> & { created_at_millis: number };

export interface RemindersRepo {
  insertOne(
    row: Pick<IReminderRow, "problem_id" | "user_id" | "due_datetime">,
    trx?: Knex.Transaction,
  ): Promise<IReminderRow>;
  findByIdForUser(
    reminderId: number,
    userId: number,
    trx?: Knex.Transaction,
  ): Promise<IReminderRow | null>;
  bulkInsert(
    input: IReminderInput[],
    trx?: Knex.Transaction,
  ): Promise<IReminderRow[]>;
  updateByIdForUser(
    reminderId: number,
    userId: number,
    patch: Partial<
      Pick<IReminderRow, "due_datetime" | "is_completed" | "completed_at">
    >,
    trx?: Knex.Transaction,
  ): Promise<IReminderRow>;
  listByProblemAndUser(
    problemId: number,
    userId: number,
    trx?: Knex.Transaction,
  ): Promise<Partial<IReminderRow>[]>;
  listByProblemIdsWithMillis(
    problemIds: number[],
    trx?: Knex.Transaction,
  ): Promise<ReminderWithMillis[]>;
  deleteByIdForUser(
    reminderId: number,
    userId: number,
    trx?: Knex.Transaction,
  ): Promise<number>;
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
  async findByIdForUser(
    reminderId: number,
    userId: number,
    trx?: Knex.Transaction,
  ): Promise<IReminderRow | null> {
    const qb = (trx ?? db)("reminders");
    return (
      (await qb
        .where({ reminder_id: reminderId, user_id: userId })
        .first<IReminderRow>()) ?? null
    );
  },
  async bulkInsert(input, trx) {
    const baseQuery = (trx ?? db)("reminders");
    return await baseQuery.insert(input).returning("*");
  },
  async updateByIdForUser(
    reminderId: number,
    userId: number,
    patch: Partial<
      Pick<IReminderRow, "due_datetime" | "is_completed" | "completed_at">
    >,
    trx?: Knex.Transaction,
  ): Promise<IReminderRow> {
    const qb = (trx ?? db)("reminders");
    const [row] = await qb
      .where({ reminder_id: reminderId, user_id: userId })
      .update({ ...patch, updated_at: new Date() })
      .returning(returnCols as string[]);
    if (!row) throw new Error("Failed to update reminder");
    return row as IReminderRow;
  },
  async listByProblemAndUser(
    problemId: number,
    userId: number,
    trx?: Knex.Transaction,
  ): Promise<Partial<IReminderRow>[]> {
    const qb = (trx ?? db)("reminders");
    return qb
      .where({ problem_id: problemId, user_id: userId })
      .select<
        Partial<IReminderRow>[]
      >("reminder_id", "due_datetime", "is_sent", "sent_at", "is_completed", "completed_at", "created_at")
      .orderBy("is_sent", "asc")
      .orderBy("due_datetime", "desc");
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
  async deleteByIdForUser(
    reminderId: number,
    userId: number,
    trx?: Knex.Transaction,
  ): Promise<number> {
    const qb = (trx ?? db)("reminders");
    return qb.where({ reminder_id: reminderId, user_id: userId }).del();
  },
};
