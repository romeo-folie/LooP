import { Knex } from "knex";
import { db } from "../db";
import {
  IProblemRow,
  IReminderRow,
  IUserPreferencesRow,
} from "../types/knex-tables";
import { ProblemWithMillis } from "../controllers/problem-controller";
import { PracticeMeta } from "../services/problem.service";
import {
  normalizeProblemRowFromDb,
  normalizeUserPreferencesRow,
  prepareProblemForInsert,
} from "../utils/db-serializers";

type ListFilters = {
  userId: number;
  queryStr?: string;
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
    input: Pick<
      IProblemRow,
      "user_id" | "name" | "difficulty" | "tags" | "date_solved" | "notes"
    >,
    trx?: Knex.Transaction,
  ): Promise<IProblemRow | undefined>;
  findById(
    userId: number,
    problemId: number,
    trx?: Knex.Transaction,
  ): Promise<IProblemRow | undefined>;
  listByUserWithFilters({
    userId,
    queryStr,
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
  async insertProblem(input, trx?: Knex) {
    const knexInstance = trx ?? db;
    // Prepare input for DB depending on client (sqlite tests vs postgres)
    const prepared = prepareProblemForInsert(input, knexInstance as Knex);

    const baseQuery = (knexInstance as Knex)("problems");
    const [row] = await baseQuery.insert(prepared).returning("*");
    // Normalize tags field when returning to app code
    return normalizeProblemRowFromDb(row, knexInstance as Knex);
  },
  async findById(userId, problemId, trx) {
    const knexInstance = trx ?? db;
    const baseQuery = (knexInstance as Knex)("problems");
    const row = await baseQuery
      .where({ user_id: userId, problem_id: problemId })
      .first();
    return normalizeProblemRowFromDb(row, knexInstance as Knex);
  },
  async listByUserWithFilters({
    userId,
    queryStr,
    difficulty,
    tags,
    date_solved,
    page,
    pageSize,
    trx,
  }) {
    const qb = (trx ?? db)("problems").where({ user_id: userId });

    function escapeLike(input: string) {
      return input.replace(/([%_\\])/g, "\\$1");
    }

    if (queryStr) {
      const safeQs = escapeLike(queryStr);
      qb.andWhereILike("name", `%${safeQs}%`);
    }
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
    const knexInstance = trx ?? db;
    const baseQuery = (knexInstance as Knex)("user_preferences");
    const row = await baseQuery
      .where({ user_id: userId })
      .select("settings")
      .first();
    const { settings } = normalizeUserPreferencesRow(row, knexInstance as Knex);
    return { settings };
  },
  async listRemindersByProblemId(problemId, userId, trx) {
    const qb = (trx ?? db)("reminders").where({ problem_id: problemId });
    if (userId) qb.andWhere({ user_id: userId });
    return qb.select("*");
  },
  async updateById(userId, problemId, data, trx) {
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
  async deleteRemindersByProblemId(problemId, trx) {
    const qb = (trx ?? db)("reminders");
    return qb.where({ problem_id: problemId }).del();
  },
  async deleteProblemById(userId, problemId, trx) {
    const qb = (trx ?? db)("problems");
    return qb.where({ user_id: userId, problem_id: problemId }).del();
  },
  async updatePracticeMeta(userId, problemId, practiceMeta, trx) {
    const qb = (trx ?? db)("problems");
    const [row] = await qb
      .where({ user_id: userId, problem_id: problemId })
      .update({ practice_meta: practiceMeta, updated_at: new Date() })
      .returning(returnCols as string[]);
    if (!row) throw new Error("Problem update failed or not found");
    return row as IProblemRow;
  },
};
