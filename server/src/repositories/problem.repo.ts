import { Knex } from "knex";
import { db } from "../db";
import {
  IProblemRow,
  IReminderRow,
  IUserPreferencesRow,
} from "../types/knex-tables";
import { IProblemInput } from "../types";
import { ProblemWithMillis } from "../controllers/problem-controller";
import { PracticeMeta } from "../services/problem-service";

type ListFilters = {
  userId: number;
  difficulty?: string;
  tags?: string[];
  date_solved?: string; // 'YYYY-MM-DD'
  page: number;
  pageSize: number;
  trx?: Knex.Transaction;
};

const returnCols: (keyof IProblemRow)[] = [
  "user_id",
  "problem_id",
  "name",
  "difficulty",
  "tags",
  "date_solved",
  "notes",
  "created_at",
  "updated_at",
];

export interface ProblemsRepo {
  insertProblem(
    input: IProblemInput,
    trx?: Knex.Transaction,
  ): Promise<IProblemRow | undefined>;
  findById(
    userId: number,
    problemId: number,
    trx?: Knex.Transaction,
  ): Promise<IProblemRow | null>;
  listByUserWithFilters({
    userId,
    difficulty,
    tags,
    date_solved,
    page,
    pageSize,
    trx,
  }: ListFilters): Promise<{ rows: ProblemWithMillis[]; total: number }>;
  getUserSettingsByUserId(
    userId: number,
    trx?: Knex.Transaction,
  ): Promise<Pick<IUserPreferencesRow, "settings"> | undefined>;
  listRemindersByProblemId(
    problemId: number,
    userId: number,
    trx?: Knex.Transaction,
  ): Promise<IReminderRow[]>;
  updateById(
    userId: number,
    problemId: number,
    data: Partial<
      Pick<
        IProblemRow,
        "name" | "difficulty" | "tags" | "date_solved" | "notes"
      >
    >,
    trx?: Knex.Transaction,
  ): Promise<IProblemRow | null>;
  deleteRemindersByProblemId(
    problemId: number,
    trx?: Knex.Transaction,
  ): Promise<number>;
  deleteProblemById(
    userId: number,
    problemId: number,
    trx?: Knex.Transaction,
  ): Promise<number>;
  updatePracticeMeta(
    userId: number,
    problemId: number,
    practiceMeta: PracticeMeta,
    trx?: Knex.Transaction,
  ): Promise<IProblemRow>;
}

export const problemsRepo: ProblemsRepo = {
  async insertProblem(input, trx) {
    const baseQuery = (trx ?? db)("problems");
    const [row] = await baseQuery.insert(input).returning("*");
    return row;
  },
  async findById(userId, problemId, trx) {
    const baseQuery = (trx ?? db)("problems");
    return (
      (await baseQuery
        .where({ user_id: userId, problem_id: problemId })
        .first()) ?? null
    );
  },
  async listByUserWithFilters({
    userId,
    difficulty,
    tags,
    date_solved,
    page,
    pageSize,
    trx,
  }: ListFilters): Promise<{ rows: ProblemWithMillis[]; total: number }> {
    const qb = (trx ?? db)("problems").where({ user_id: userId });

    if (difficulty) qb.andWhere("difficulty", difficulty);
    if (tags?.length) qb.andWhereRaw("tags @> ?", [tags]);
    if (date_solved) qb.andWhere("date_solved", date_solved);

    // total count
    const countRow = await qb
      .clone()
      .clearSelect()
      .clearOrder()
      .count<{ count: string }[]>("* as count")
      .first();

    const total = Number(countRow?.count ?? 0);

    const rows = await qb
      .clone()
      .select<ProblemWithMillis[]>(
        "problem_id",
        "user_id",
        "name",
        "difficulty",
        "tags",
        "date_solved",
        "notes",
        "created_at",
        db.raw(
          "(EXTRACT(EPOCH FROM created_at) * 1000)::double precision AS created_at_millis",
        ),
      )
      .orderBy("created_at", "desc")
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { rows, total };
  },
  async getUserSettingsByUserId(userId, trx) {
    const baseQuery = (trx ?? db)("user_preferences");
    return await baseQuery
      .where({ user_id: userId })
      .select("settings")
      .first();
  },
  async listRemindersByProblemId(
    problemId: number,
    userId?: number,
    trx?: Knex.Transaction,
  ): Promise<IReminderRow[]> {
    const qb = (trx ?? db)("reminders").where({ problem_id: problemId });
    if (userId) qb.andWhere({ user_id: userId });
    return qb.select("*");
  },
  async updateById(
    userId: number,
    problemId: number,
    data: Partial<
      Pick<
        IProblemRow,
        "name" | "difficulty" | "tags" | "date_solved" | "notes"
      >
    >,
    trx?: Knex.Transaction,
  ): Promise<IProblemRow | null> {
    const qb = (trx ?? db)("problems");
    const [row] = await qb
      .where({ user_id: userId, problem_id: problemId })
      .update(data)
      .returning(returnCols as string[]);

    if (!row) {
      throw new Error("Problem update failed or not found");
    }
    return (row as IProblemRow) || null;
  },
  async deleteRemindersByProblemId(
    problemId: number,
    trx?: Knex.Transaction,
  ): Promise<number> {
    const qb = (trx ?? db)("reminders");
    return qb.where({ problem_id: problemId }).del();
  },
  async deleteProblemById(
    userId: number,
    problemId: number,
    trx?: Knex.Transaction,
  ): Promise<number> {
    const qb = (trx ?? db)("problems");
    return qb.where({ user_id: userId, problem_id: problemId }).del();
  },
  async updatePracticeMeta(
    userId: number,
    problemId: number,
    practiceMeta: PracticeMeta,
    trx?: Knex.Transaction,
  ): Promise<IProblemRow> {
    const qb = (trx ?? db)("problems");
    const [row] = await qb
      .where({ user_id: userId, problem_id: problemId })
      .update({ practice_meta: practiceMeta, updated_at: new Date() })
      .returning(returnCols as string[]);
    if (!row) throw new Error("Problem update failed or not found");
    return row as IProblemRow;
  },
};
