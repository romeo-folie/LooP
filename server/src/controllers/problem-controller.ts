/* eslint-disable @typescript-eslint/no-empty-object-type */
import { AppRequestHandler, IProblemInput } from "../types";
import { IProblemRow, IReminderRow } from "../types/knex-tables";
import AppError from "../types/errors";
import {
  createWithReminders,
  deleteProblem,
  type ProblemUpdateBody,
  recordPracticeFeedback,
  updateProblem,
} from "../services/problem.service";
import { problemsRepo } from "../repositories/problem.repo";
import { remindersRepo } from "../repositories/reminder.repo";

export type ProblemWithMillis = Pick<
  IProblemRow,
  | "problem_id"
  | "user_id"
  | "name"
  | "difficulty"
  | "tags"
  | "date_solved"
  | "notes"
  | "created_at"
> & { created_at_millis: number };

export type ReminderWithMillis = Pick<
  IReminderRow,
  "reminder_id" | "problem_id" | "due_datetime" | "is_sent" | "sent_at"
> & { created_at_millis: number };

type ProblemWithReminders = ProblemWithMillis & {
  reminders: ReminderWithMillis[];
};

type ProblemsQuery = {
  queryStr?: string;
  difficulty?: string;
  tags?: string;
  date_solved?: string;
  page?: string;
  pageSize?: string;
};

export const handleCreateProblem: AppRequestHandler<
  {},
  { message: string; problem: Partial<IProblemRow> },
  IProblemInput,
  {}
> = async (req, res, next) => {
  try {
    const userId = req.authUser?.userId;
    const isFromWorker = req.headers["x-sync-origin"] === "service-worker";

    if (!userId) {
      req.log?.warn(`Unauthorized problem creation attempt from IP: ${req.ip}`);
      throw new AppError("UNAUTHORIZED");
    }

    const result = await createWithReminders({
      userId,
      input: req.body,
      isFromWorker,
      log: req.log,
    });

    res.status(201).json(result);
  } catch (error: unknown) {
    req.log?.error("handleCreateProblem:failure", {
      userId: req.authUser?.userId,
    });
    next(error);
  }
};

export const handleGetProblems: AppRequestHandler<
  {},
  {
    problems: ProblemWithReminders[];
    meta: {
      totalItems: number;
      totalPages: number;
      page: number;
      pageSize: number;
    };
  },
  {},
  ProblemsQuery
> = async (req, res, next) => {
  try {
    const userId = req.authUser?.userId;
    if (!userId) {
      req.log?.warn(`Unauthorized problem request attempt from IP: ${req.ip}`);
      throw new AppError("UNAUTHORIZED");
    }

    const {
      queryStr,
      difficulty,
      tags,
      date_solved,
      page: pageStr,
      pageSize: pageSizeStr,
    } = req.query;

    const page = Math.max(1, Number.parseInt(pageStr ?? "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(pageSizeStr ?? "10", 10)),
    );

    const tagsArray =
      typeof tags === "string"
        ? tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined;

    req.log?.info("Fetching problems", {
      userId,
      difficulty,
      tags: tagsArray,
      date_solved,
      page,
      pageSize,
    });

    const { rows: problems, total } = await problemsRepo.listByUserWithFilters({
      userId,
      queryStr,
      difficulty,
      tags: tagsArray,
      date_solved,
      page,
      pageSize,
    });

    if (problems.length === 0) {
      res.status(200).json({
        problems: [],
        meta: { totalItems: total, totalPages: 0, page, pageSize },
      });
      return;
    }

    // Fetch reminders for these problems (with created_at_millis)
    const problemIds = problems.map((p) => p.problem_id);
    const reminders =
      await remindersRepo.listByProblemIdsWithMillis(problemIds);

    // Group reminders by problem_id
    const byProblem = reminders.reduce<Record<number, ReminderWithMillis[]>>(
      (acc, r) => {
        (acc[r.problem_id] ??= []).push(r);
        return acc;
      },
      {},
    );

    // Attach reminders to problems
    const problemsWithReminders: ProblemWithReminders[] = problems.map((p) => ({
      ...p,
      reminders: byProblem[p.problem_id] ?? [],
    }));

    req.log?.info("Fetched problems success", {
      userId,
      count: problems.length,
      total,
    });

    res.status(200).json({
      problems: problemsWithReminders,
      meta: {
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
        page,
        pageSize,
      },
    });
  } catch (error) {
    req.log?.error(
      `Error fetching problems for User ID: ${req.authUser?.userId || "unknown"}: ${
        error instanceof Error ? error.message : error
      }`,
    );
    next(error);
  }
};

export const handleGetProblemById: AppRequestHandler<
  { problem_id: string },
  { problem: IProblemRow }
> = async (req, res, next) => {
  try {
    const userId = req.authUser?.userId;
    const { problem_id } = req.params;

    if (!userId) {
      req.log?.warn(`Unauthorized problem request attempt from IP: ${req.ip}`);
      throw new AppError("UNAUTHORIZED");
    }

    const problemIdNum = Number(problem_id);
    if (!Number.isInteger(problemIdNum) || problemIdNum <= 0) {
      req.log?.warn("handleGetProblemById: invalid problem_id", { problem_id });
      throw new AppError("BAD_REQUEST", "Invalid problem_id");
    }

    req.log?.info("handleGetProblemById:start", {
      userId,
      problemId: problemIdNum,
    });

    const problem = await problemsRepo.findById(userId, problemIdNum);

    if (!problem) {
      req.log?.warn("handleGetProblemById:not_found", {
        userId,
        problemId: problemIdNum,
      });
      throw new AppError("NOT_FOUND", "Problem not found");
    }

    req.log?.info("handleGetProblemById:success", {
      userId,
      problemId: problem.problem_id,
    });
    res.status(200).json({ problem });
  } catch (error) {
    req.log?.error("handleGetProblemById:error", {
      userId: req.authUser?.userId ?? "unknown",
      problem_id: req.params.problem_id,
      message: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const handleUpdateProblem: AppRequestHandler<
  { problem_id: string },
  { message: string; problem: IProblemRow },
  ProblemUpdateBody
> = async (req, res, next) => {
  try {
    const userId = req.authUser?.userId;
    if (!userId) {
      req.log?.warn(`Unauthorized problem update attempt from IP: ${req.ip}`);
      throw new AppError("UNAUTHORIZED");
    }

    const problemIdNum = Number(req.params.problem_id);
    if (!Number.isInteger(problemIdNum) || problemIdNum <= 0) {
      req.log?.warn("handleUpdateProblem: invalid problem_id", {
        problem_id: req.params.problem_id,
      });
      throw new AppError("BAD_REQUEST", "Invalid problem_id");
    }

    const updated = await updateProblem({
      userId,
      problemId: problemIdNum,
      data: req.body,
      log: req.log,
    });

    res.status(200).json({
      message: "Problem updated successfully",
      problem: updated,
    });
  } catch (error) {
    req.log?.error("handleUpdateProblem:error", {
      userId: req.authUser?.userId ?? "unknown",
      problem_id: req.params.problem_id,
      message: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const handleDeleteProblem: AppRequestHandler<
  { problem_id: string },
  { message: string }
> = async (req, res, next) => {
  try {
    const userId = req.authUser?.userId;
    if (!userId) {
      req.log?.warn(`Unauthorized problem deletion attempt from IP: ${req.ip}`);
      throw new AppError("UNAUTHORIZED");
    }

    const problemIdNum = Number(req.params.problem_id);
    if (!Number.isInteger(problemIdNum) || problemIdNum <= 0) {
      req.log?.warn("handleDeleteProblem: invalid problem_id", {
        problem_id: req.params.problem_id,
      });
      throw new AppError("BAD_REQUEST", "Invalid problem_id");
    }

    await deleteProblem({ userId, problemId: problemIdNum, log: req.log });

    res.status(200).json({ message: "Problem deleted successfully" });
  } catch (error) {
    req.log?.error("handleDeleteProblem:error", {
      userId: req.authUser?.userId ?? "unknown",
      problem_id: req.params.problem_id,
      message: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const handlePracticeFeedback: AppRequestHandler<
  { problem_id: string },
  { message: string },
  { quality_score: number }
> = async (req, res, next) => {
  try {
    const userId = req.authUser?.userId;
    const { problem_id } = req.params;
    const { quality_score } = req.body;

    if (!userId) {
      throw new AppError("UNAUTHORIZED");
    }

    const problemIdNum = Number(problem_id);
    if (!Number.isInteger(problemIdNum) || problemIdNum <= 0) {
      throw new AppError("BAD_REQUEST", "Invalid problem_id");
    }

    const { nextDue } = await recordPracticeFeedback({
      userId,
      problemId: problemIdNum,
      qualityScore: Number(quality_score),
      log: req.log,
    });

    res.status(200).json({
      message: `Next reminder on ${nextDue.toDateString()}`,
    });
  } catch (error) {
    req.log?.error("handlePracticeFeedback:error", {
      userId: req.authUser?.userId ?? "unknown",
      problem_id: req.params.problem_id,
      message: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};
