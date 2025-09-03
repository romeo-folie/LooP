/* eslint-disable @typescript-eslint/no-empty-object-type */
import { db } from "../db";
import { AppRequestHandler, IProblem } from "../types";
import sm2 from "../utils/sm2-helper";
import { IProblemRow, IReminderRow } from "../types/knex-tables";
import AppError from "../types/errors";

type ProblemWithMillis = {
  problem_id: number;
  user_id: number;
  name: string;
  difficulty: IProblemRow["difficulty"];
  tags: IProblemRow["tags"];
  date_solved: IProblemRow["date_solved"];
  notes: IProblemRow["notes"];
  created_at: IProblemRow["created_at"];
  created_at_millis: number;
};

type ReminderWithMillis = {
  reminder_id: number;
  problem_id: number;
  due_datetime: IReminderRow["due_datetime"];
  is_sent: boolean;
  sent_at: IReminderRow["sent_at"];
  created_at_millis: number;
};

type ProblemWithReminders = ProblemWithMillis & {
  reminders: ReminderWithMillis[];
};

export const createProblem: AppRequestHandler<
  {},
  { message: string; problem: Partial<IProblemRow> },
  IProblem,
  {}
> = async (req, res, next) => {
  try {
    const {
      name,
      difficulty,
      tags,
      date_solved,
      notes,
      reminders = [],
    } = req.body;
    const userId = req.authUser?.userId;
    const isFromWorker = req.headers["x-sync-origin"] === "service-worker";

    if (!userId) {
      req.log?.warn(`Unauthorized problem creation attempt from IP: ${req.ip}`);
      throw new AppError("UNAUTHORIZED");
    }

    req.log?.info(
      `Creating problem for User ID: ${userId} - ${JSON.stringify(req.body)}`,
    );

    const [newProblem] = await db("problems")
      .insert({
        user_id: userId,
        name,
        difficulty,
        tags,
        date_solved,
        notes,
      })
      .returning([
        "problem_id",
        "user_id",
        "name",
        "difficulty",
        "tags",
        "date_solved",
        "notes",
        "created_at",
      ]);

    if (!newProblem) {
      req.log?.error(`Failed to create problem record for User ID: ${userId}`);
      throw new Error("Failed to create problem record");
    }

    const { settings } =
      (await db("user_preferences")
        .where({ user_id: userId })
        .select("settings")
        .first()) ?? {};

    if (isFromWorker && reminders.length) {
      const syncReminders = reminders.map((rem: { due_datetime: Date }) => ({
        problem_id: newProblem.problem_id,
        user_id: userId,
        due_datetime: rem.due_datetime,
      }));

      await db("reminders").insert(syncReminders);
    } else if (settings && settings.autoReminders) {
      const reminderIntervals = [3, 7, 15];
      const defaultReminders = reminderIntervals.map((interval) => {
        const dueDate = new Date(date_solved);
        dueDate.setDate(dueDate.getDate() + interval);
        dueDate.setHours(9, 0, 0, 0);

        return {
          problem_id: newProblem.problem_id,
          user_id: userId,
          due_datetime: dueDate,
        };
      });

      await db("reminders").insert(defaultReminders);
    }

    req.log?.info(
      `Problem created successfully for User ID: ${userId}, Problem ID: ${newProblem.problem_id}`,
    );

    res.status(201).json({
      message: `Problem created successfully ${settings && settings.autoReminders ? "with scheduled reminders" : ""}`,
      problem: newProblem,
    });
  } catch (error: unknown) {
    req.log?.error(
      `Problem creation error for User ID: ${req.authUser?.userId || "unknown"}: ${error instanceof Error ? error.message : error}`,
    );
    next(error);
  }
};

export const getProblems: AppRequestHandler<
  {},
  { problems: ProblemWithReminders[] },
  {},
  { difficulty: string; tags: string; date_solved: string }
> = async (req, res, next) => {
  try {
    const userId = req.authUser?.userId;

    if (!userId) {
      req.log?.warn(`Unauthorized problem request attempt from IP: ${req.ip}`);
      throw new AppError("UNAUTHORIZED");
    }

    req.log?.info(`Fetching problems for User ID: ${userId}`);

    // Extract optional query parameters
    const { difficulty, tags, date_solved } = req.query;
    let query = db<IProblemRow>("problems")
      .where({ user_id: userId })
      .select<
        ProblemWithMillis[]
      >("problem_id", "user_id", "name", "difficulty", "tags", "date_solved", "notes", "created_at", db.raw("FLOOR(EXTRACT(EPOCH FROM created_at) * 1000)::double precision AS created_at_millis"))
      .orderBy("created_at_millis", "desc");

    // Apply filters if present
    if (difficulty) {
      query = query.where("difficulty", difficulty as string);
    }
    if (tags) {
      const tagsArray = tags.split(",");
      query = query.whereRaw("tags @> ?", [tagsArray]);
    }
    if (date_solved) {
      query = query.where("date_solved", date_solved as string);
    }

    // Fetch problems
    const problems = await query;
    if (problems.length === 0) {
      res.status(200).json({ problems: [] });
    }

    // Fetch reminders for the problems
    const problemIds = problems.map((p) => p.problem_id);
    const reminders = await db<IReminderRow>("reminders")
      .whereIn("problem_id", problemIds)
      .select<ReminderWithMillis[]>(
        "reminder_id",
        "problem_id",
        "due_datetime",
        "is_sent",
        "sent_at",
        // 'is_completed',
        // 'completed_at',
        // "created_at",
        db.raw(
          "FLOOR(EXTRACT(EPOCH FROM created_at) * 1000)::double precision AS created_at_millis",
        ),
      )
      .orderBy("is_sent", "asc")
      .orderBy("due_datetime", "desc");

    // Map reminders to their corresponding problems
    const remindersMap = reminders.reduce<Record<number, ReminderWithMillis[]>>(
      (acc, reminder) => {
        if (!acc[reminder.problem_id]) {
          acc[reminder.problem_id] = [];
        }
        acc[reminder.problem_id]!.push(reminder);
        return acc;
      },
      {} as Record<number, ReminderWithMillis[]>,
    );

    // Attach reminders to their respective problems
    const problemsWithReminders = problems.map((problem) => ({
      ...problem,
      reminders: remindersMap[problem.problem_id] || [],
    }));

    req.log?.info(
      `Successfully fetched ${problems.length} problems for User ID: ${userId}`,
    );

    //TODO: pagination
    res.status(200).json({ problems: problemsWithReminders });
  } catch (error: unknown) {
    req.log?.error(
      `Error fetching problems for User ID: ${req.authUser?.userId || "unknown"}: ${error instanceof Error ? error.message : error}`,
    );
    next(error);
  }
};

export const getProblemById: AppRequestHandler<
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

    req.log?.info(`Fetching problem ID: ${problem_id} for User ID: ${userId}`);

    // Fetch the problem belonging to the authenticated user
    const problem = await db("problems")
      .where({ problem_id: parseInt(problem_id), user_id: userId })
      .first();

    if (!problem) {
      req.log?.warn(
        `Problem ID: ${problem_id} not found for User ID: ${userId}`,
      );
      throw new Error("Problem not found");
    }

    req.log?.info(
      `Successfully fetched Problem ID ${problem_id} for User ID: ${userId}`,
    );

    res.status(200).json({ problem });
  } catch (error: unknown) {
    req.log?.error(
      `Error fetching problem ID: ${req.params.problem_id} - User ID: ${req.authUser?.userId || "unknown"}: ${error instanceof Error ? error.message : error}`,
    );
    next(error);
  }
};

export const updateProblem: AppRequestHandler<
  { problem_id: string },
  { message: string; problem: IProblemRow },
  {
    name: string;
    difficulty: string;
    tags: string[];
    date_solved: Date;
    notes: string;
  }
> = async (req, res, next) => {
  try {
    const userId = req.authUser?.userId;
    const { problem_id } = req.params;
    const { name, difficulty, tags, date_solved, notes } = req.body;

    if (!userId) {
      req.log?.warn(
        `Unauthorized problem update attempt for ID: ${userId} from IP: ${req.ip}`,
      );
      throw new AppError("UNAUTHORIZED");
    }

    req.log?.info(
      `Updating transaction ID: ${problem_id} for User ID: ${userId}`,
    );

    const existingProblem = await db("problems")
      .where({ problem_id: parseInt(problem_id), user_id: userId })
      .first();

    if (!existingProblem) {
      req.log?.warn(
        `Problem ID: ${problem_id} not found for User ID: ${userId}`,
      );
      throw new AppError("NOT_FOUND", "Problem Not Found");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedFields: Record<string, any> = {};
    if (name) updatedFields.name = name;
    if (difficulty) updatedFields.difficulty = difficulty;
    if (tags) updatedFields.tags = tags;
    if (date_solved) updatedFields.date_solved = date_solved;
    if (notes) updatedFields.notes = notes;

    const [updatedProblem] = await db("problems")
      .where({ problem_id: parseInt(problem_id), user_id: userId })
      .update(updatedFields)
      .returning([
        "user_id",
        "problem_id",
        "name",
        "difficulty",
        "tags",
        "date_solved",
        "notes",
        "created_at",
        "updated_at",
      ]);

    if (!updatedProblem) {
      req.log?.error(`Failed to update problem for user ${userId}`);
      throw new Error("Failed to update problem");
    }

    req.log?.info(
      `Problem ID: ${problem_id} successfully updated for User ID: ${userId}`,
    );

    res.status(200).json({
      message: "Problem updated successfully",
      problem: updatedProblem,
    });
  } catch (error: unknown) {
    req.log?.error(
      `Problem update error for ID: ${req.params.problem_id} - User ID: ${req.authUser?.userId || "unknown"}: ${error instanceof Error ? error.message : error}`,
    );
    next(error);
  }
};

export const deleteProblem: AppRequestHandler<
  { problem_id: string },
  { message: string }
> = async (req, res, next) => {
  try {
    const userId = req.authUser?.userId;
    const { problem_id } = req.params;

    if (!userId) {
      req.log?.warn(
        `Unauthorized problem deletion attempt for ID: ${problem_id} from IP: ${req.ip}`,
      );
      throw new AppError("UNAUTHORIZED");
    }

    // Ensure the problem exists and belongs to the authenticated user
    const existingProblem = await db("problems")
      .where({ problem_id: parseInt(problem_id), user_id: userId })
      .first();

    if (!existingProblem) {
      req.log?.warn(
        `Problem ID: ${problem_id} not found for User ID: ${userId}`,
      );
      throw new AppError("NOT_FOUND", "Problem Not Found");
    }

    // Delete associated reminders first to maintain integrity
    await db("reminders")
      .where({ problem_id: parseInt(problem_id) })
      .del();

    // Delete the problem
    await db("problems")
      .where({ problem_id: parseInt(problem_id) })
      .del();

    req.log?.info(
      `Problem ID: ${problem_id} successfully deleted for User ID: ${userId}`,
    );

    res.status(200).json({ message: "Problem deleted successfully" });
  } catch (error: unknown) {
    req.log?.error(
      `Problem deletion error for ID: ${req.params.problem_id} - User ID: ${req.authUser?.userId || "unknown"}: ${error instanceof Error ? error.message : error}`,
    );
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
    const { quality_score } = req.body; // 1–5

    if (!userId) {
      throw new AppError("UNAUTHORIZED");
    }

    // Fetch problem & ensure ownership
    const problem = await db("problems")
      .where({ problem_id: parseInt(problem_id), user_id: userId })
      .first();

    if (!problem) {
      throw new AppError("NOT_FOUND", "Problem Not Found");
    }

    // Parse existing meta or set defaults
    const meta = problem.practice_meta ?? {};
    const attemptCount = (meta.attempt_count ?? 0) + 1;
    const prevEF = meta.ease_factor ?? 2.5;
    const prevInterval = meta.interval ?? 0;

    // Run SM‑2
    const { newEF, newInterval } = sm2(
      prevEF,
      prevInterval,
      attemptCount,
      Number(quality_score),
    );

    const now = new Date();
    const nextDue = new Date(now);
    nextDue.setDate(nextDue.getDate() + newInterval);
    // set to 09:00 AM
    nextDue.setHours(9, 0, 0, 0);

    const updatedMeta = {
      attempt_count: attemptCount,
      last_attempted_at: now.toISOString(),
      ease_factor: newEF,
      interval: newInterval,
      next_due_at: nextDue.toISOString(),
      quality_score: Number(quality_score),
    };

    // Update problem
    await db("problems")
      .where({ problem_id: parseInt(problem_id) })
      .update({
        practice_meta: updatedMeta,
        updated_at: now,
      });

    // Create new reminder˝
    await db("reminders").insert({
      problem_id: parseInt(problem_id),
      user_id: userId,
      due_datetime: nextDue,
      created_at: now,
      updated_at: now,
    });

    req.log?.info(
      `Practice feedback recorded for problem ${problem_id} (user ${userId}) — next due ${nextDue.toISOString()}`,
    );

    res.status(200).json({
      message: `Next reminder on ${nextDue.toDateString()}`,
    });
  } catch (error: unknown) {
    req.log?.error(
      `Error updating problem practice meta for PROBLEM ID: ${req.params.problem_id} - User ID: ${req.authUser?.userId || "unknown"}: ${error instanceof Error ? error.message : error}`,
    );
    next(error);
  }
};
