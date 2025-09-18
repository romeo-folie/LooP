import { Knex } from "knex";
import { db } from "../db";
import { problemsRepo } from "../repositories/problem.repo";
import { IProblemRow, IReminderRow } from "../types/knex-tables";
import { IProblemInput } from "../types";
import { Logger } from "winston";
import AppError from "../types/errors";
import { remindersRepo } from "../repositories/reminder.repo";
import sm2 from "../utils/sm2-helper";

type CreateWithRemindersArgs = {
  userId: number;
  input: IProblemInput;
  isFromWorker?: boolean;
  log?: Logger;
};

type CreateWithRemindersResult = {
  message: string;
  problem: Partial<IProblemRow>;
};

type GetProblemByIdArgs = {
  userId: number;
  problemId: number;
  log?: Logger;
  trx?: Knex.Transaction;
};

const updatableProblemKeys = [
  "name",
  "difficulty",
  "tags",
  "date_solved",
  "notes",
] as const;

type UpdatableProblemKey = (typeof updatableProblemKeys)[number];

type UpdateProblemArgs = {
  userId: number;
  problemId: number;
  data: ProblemUpdateBody;
  log?: Logger;
  trx?: Knex.Transaction;
};

type DeleteProblemArgs = {
  userId: number;
  problemId: number;
  log?: Logger;
  trx?: Knex.Transaction;
};

type RecordPracticeFeedbackArgs = {
  userId: number;
  problemId: number;
  qualityScore: number;
  log?: Logger;
  trx?: Knex.Transaction;
};

export type PracticeMeta = {
  attempt_count: number;
  last_attempted_at: string; // ISO
  ease_factor: number;
  interval: number; // days
  next_due_at: string; // ISO
  quality_score: number; // 1–5
};

export type ProblemUpdateBody = Partial<Pick<IProblemRow, UpdatableProblemKey>>;

function pickDefined<T extends object, K extends readonly (keyof T)[]>(
  src: T,
  keys: K,
): Partial<Pick<T, K[number]>> {
  const out: Partial<Pick<T, K[number]>> = {};
  for (const k of keys) {
    const v = src[k];
    if (v !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (out as any)[k] = v;
    }
  }
  return out;
}

export async function createWithReminders({
  userId,
  input,
  isFromWorker = false,
  log,
}: CreateWithRemindersArgs): Promise<CreateWithRemindersResult> {
  if (!userId) throw new AppError("UNAUTHORIZED", "Missing user id");

  const { name, difficulty, tags, date_solved, notes, reminders = [] } = input;

  log?.info("createWithReminders:start", {
    userId,
    name,
    difficulty,
    tags,
    date_solved,
    notes,
    isFromWorker,
    remindersCount: reminders.length,
  });

  // make all tags lowercase before saving
  const tagList = tags.map((t) => t.toLowerCase().trim());

  return await db.transaction(async (trx: Knex.Transaction) => {
    // 1) Insert problem
    const problem = await problemsRepo.insertProblem(
      {
        user_id: userId,
        name,
        difficulty,
        tags: tagList,
        date_solved: new Date(date_solved),
        notes: notes,
      },
      trx,
    );

    if (!problem) {
      throw new AppError("INTERNAL", "Failed to create problem record");
    }

    // 2) Fetch user settings
    const row = await problemsRepo.getUserSettingsByUserId(userId, trx);
    const autoRemindersEnabled = Boolean(row?.settings.autoReminders);

    // 3) Decide which reminders to insert
    let remindersToInsert: Array<
      Pick<IReminderRow, "problem_id" | "user_id" | "due_datetime">
    > = [];

    if (isFromWorker && reminders.length) {
      // Service Worker sync path
      remindersToInsert = reminders.map((r) => ({
        problem_id: problem.problem_id,
        user_id: userId,
        due_datetime: new Date(r.due_datetime),
      }));
    } else if (autoRemindersEnabled) {
      const base = new Date(date_solved as unknown as string);
      const intervals = [3, 7, 15];
      remindersToInsert = intervals.map((d) => {
        const due = new Date(base);
        due.setDate(due.getDate() + d);
        due.setHours(9, 0, 0, 0);
        return {
          problem_id: problem.problem_id,
          user_id: userId,
          due_datetime: due,
        };
      });
    }

    if (remindersToInsert.length > 0) {
      await remindersRepo.bulkInsert(remindersToInsert, trx);
    }

    const scheduledSuffix =
      remindersToInsert.length > 0 ? " with scheduled reminders" : "";

    log?.info("createWithReminders:success", {
      userId,
      problemId: problem.problem_id,
      remindersCreated: remindersToInsert.length,
    });

    return {
      message: `Problem created successfully${scheduledSuffix}`,
      problem,
    };
  });
}

export async function getProblemById({
  userId,
  problemId,
  log,
  trx,
}: GetProblemByIdArgs): Promise<IProblemRow> {
  if (!userId) {
    log?.warn("getProblemById: unauthorized (missing userId)");
    throw new AppError("UNAUTHORIZED");
  }

  log?.info("getProblemById:start", { userId, problemId });

  const problem = await problemsRepo.findById(userId, problemId, trx);

  if (!problem) {
    log?.warn("getProblemById:not_found", { userId, problemId });
    throw new AppError("NOT_FOUND", "Problem not found");
  }

  log?.info("getProblemById:success", {
    userId,
    problemId: problem.problem_id,
  });
  return problem;
}

export async function updateProblem({
  userId,
  problemId,
  data,
  log,
  trx,
}: UpdateProblemArgs): Promise<IProblemRow> {
  if (!userId) throw new AppError("UNAUTHORIZED");

  log?.info("updateProblem:start", { userId, problemId });

  // Ensure record exists and belongs to user
  const existing = await problemsRepo.findById(userId, problemId, trx);
  if (!existing) {
    log?.warn("updateProblem:not_found", { userId, problemId });
    throw new AppError("NOT_FOUND", "Problem Not Found");
  }

  // Build strictly-typed update payload
  const patch = pickDefined<ProblemUpdateBody, typeof updatableProblemKeys>(
    data,
    updatableProblemKeys,
  );

  if (Object.keys(patch).length === 0) {
    log?.warn("updateProblem:no_fields", { userId, problemId });
    throw new AppError("BAD_REQUEST", "No updatable fields provided");
  }

  const updated = await problemsRepo.updateById(userId, problemId, patch, trx);

  if (!updated) throw new AppError("NOT_FOUND", "Problem Not Found");

  log?.info("updateProblem:success", { userId, problemId: updated.problem_id });
  return updated;
}

export async function deleteProblem({
  userId,
  problemId,
  log,
  trx,
}: DeleteProblemArgs): Promise<void> {
  if (!userId) throw new AppError("UNAUTHORIZED");

  log?.info("deleteProblem:start", { userId, problemId });

  // Ensure it exists and belongs to user
  const existing = await problemsRepo.findById(userId, problemId, trx);
  if (!existing) {
    log?.warn("deleteProblem:not_found", { userId, problemId });
    throw new AppError("NOT_FOUND", "Problem Not Found");
  }

  // Transactionally delete reminders then the problem
  await db.transaction(async (t) => {
    await problemsRepo.deleteRemindersByProblemId(problemId, t);
    const deleted = await problemsRepo.deleteProblemById(userId, problemId, t);
    if (deleted === 0) {
      throw new AppError("NOT_FOUND", "Problem Not Found");
    }
  });

  log?.info("deleteProblem:success", { userId, problemId });
}

export async function recordPracticeFeedback({
  userId,
  problemId,
  qualityScore,
  log,
  trx,
}: RecordPracticeFeedbackArgs): Promise<{
  nextDue: Date;
  problem: IProblemRow;
}> {
  if (!userId) throw new AppError("UNAUTHORIZED");
  if (!Number.isFinite(qualityScore) || qualityScore < 0 || qualityScore > 5) {
    throw new AppError("BAD_REQUEST", "quality_score must be between 0 and 5");
  }

  return db.transaction(async (t) => {
    const tx = trx ?? t;

    // Ensure ownership / existence
    const problem = await problemsRepo.findById(userId, problemId, tx);
    if (!problem) {
      throw new AppError("NOT_FOUND", "Problem Not Found");
    }

    const meta = (problem.practice_meta as Partial<PracticeMeta> | null) ?? {};
    const attemptCount = (meta.attempt_count ?? 0) + 1;
    const prevEF = meta.ease_factor ?? 2.5;
    const prevInterval = meta.interval ?? 0;

    // SM2 calculation
    const { newEF, newInterval } = sm2(
      prevEF,
      prevInterval,
      attemptCount,
      qualityScore,
    );

    const now = new Date();
    const nextDue = new Date(now);
    nextDue.setDate(nextDue.getDate() + newInterval);
    nextDue.setHours(9, 0, 0, 0); // 09:00 local

    const updatedMeta: PracticeMeta = {
      attempt_count: attemptCount,
      last_attempted_at: now.toISOString(),
      ease_factor: newEF,
      interval: newInterval,
      next_due_at: nextDue.toISOString(),
      quality_score: qualityScore,
    };

    // Update problem meta
    const updatedProblem = await problemsRepo.updatePracticeMeta(
      userId,
      problemId,
      updatedMeta,
      tx,
    );

    // Insert next reminder
    await remindersRepo.insertOne(
      {
        problem_id: problemId,
        user_id: userId,
        due_datetime: nextDue,
      },
      tx,
    );

    log?.info("recordPracticeFeedback:success", {
      userId,
      problemId,
      attemptCount,
      nextDue: nextDue.toISOString(),
    });

    return { nextDue, problem: updatedProblem };
  });
}
