import { RequestHandler, Response } from "express";
import { db } from "../db";
import { AuthenticatedRequest } from "../types/authenticated-request";
import logger from "../config/winston-config";
import sm2 from "../utils/sm2-helper";

export const createProblem: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
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
      logger.warn(`Unauthorized problem creation attempt from IP: ${req.ip}`);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    logger.info(
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
        dueDate.setHours(9, 0, 0, 0); // Set to 09:00 AM

        return {
          problem_id: newProblem.problem_id,
          user_id: userId,
          due_datetime: dueDate.toISOString(),
        };
      });

      await db("reminders").insert(defaultReminders);
    }

    logger.info(
      `Problem created successfully for User ID: ${userId}, Problem ID: ${newProblem.problem_id}`,
    );

    res.status(201).json({
      message: `Problem created successfully ${settings && settings.autoReminders ? "with scheduled reminders" : ""}`,
      problem: newProblem,
    });
  } catch (error: unknown) {
    logger.error(
      `Problem creation error for User ID: ${req.authUser?.userId || "unknown"}: ${error instanceof Error ? error.message : error}`,
    );
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getProblems: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.authUser?.userId;

    if (!userId) {
      logger.warn(`Unauthorized problem request attempt from IP: ${req.ip}`);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    logger.info(`Fetching problems for User ID: ${userId}`);

    // Extract optional query parameters
    const { difficulty, tags, date_solved } = req.query;
    let query = db("problems")
      .where({ user_id: userId })
      .select(
        "problem_id",
        "user_id",
        "name",
        "difficulty",
        "tags",
        "date_solved",
        "notes",
        db.raw(
          "FLOOR(EXTRACT(EPOCH FROM created_at) * 1000)::BIGINT AS created_at",
        ),
      )
      .orderBy("created_at", "desc");

    // Apply filters if present
    if (difficulty) {
      query = query.where("difficulty", difficulty as string);
    }
    if (tags) {
      const tagsArray = (tags as string).split(",");
      query = query.whereRaw("tags @> ?", [tagsArray]);
    }
    if (date_solved) {
      query = query.where("date_solved", date_solved as string);
    }

    // Fetch problems
    const problems = await query;

    // Fetch reminders for the problems
    const problemIds = problems.map((p) => p.problem_id);
    const reminders = await db("reminders")
      .whereIn("problem_id", problemIds)
      .select(
        "reminder_id",
        "problem_id",
        "due_datetime",
        "is_sent",
        "sent_at",
        // 'is_completed',
        // 'completed_at',
        // "created_at",
        db.raw(
          "FLOOR(EXTRACT(EPOCH FROM created_at) * 1000)::BIGINT AS created_at",
        ),
      )
      .orderBy("is_sent", "asc")
      .orderBy("due_datetime", "desc");

    // Map reminders to their corresponding problems
    const remindersMap = reminders.reduce(
      (acc, reminder) => {
        if (!acc[reminder.problem_id]) {
          acc[reminder.problem_id] = [];
        }
        acc[reminder.problem_id].push(reminder);
        return acc;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as Record<number, any[]>,
    );

    // Attach reminders to their respective problems
    const problemsWithReminders = problems.map((problem) => ({
      ...problem,
      created_at: parseInt(problem.created_at),
      reminders: remindersMap[problem.problem_id] || [],
    }));

    logger.info(
      `Successfully fetched ${problems.length} problems for User ID: ${userId}`,
    );

    res.status(200).json({ problems: problemsWithReminders });
  } catch (error: unknown) {
    logger.error(
      `Error fetching problems for User ID: ${req.authUser?.userId || "unknown"}: ${error instanceof Error ? error.message : error}`,
    );
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getProblemById: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.authUser?.userId;
    const { problem_id } = req.params;

    if (!userId) {
      logger.warn(`Unauthorized problem request attempt from IP: ${req.ip}`);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    logger.info(`Fetching problem ID: ${problem_id} for User ID: ${userId}`);

    // Fetch the problem belonging to the authenticated user
    const problem = await db("problems")
      .where({ problem_id, user_id: userId })
      .first();

    if (!problem) {
      logger.warn(`Problem ID: ${problem_id} not found for User ID: ${userId}`);
      res.status(404).json({ error: "Problem not found" });
      return;
    }

    logger.info(
      `Successfully fetched Problem ID ${problem_id} for User ID: ${userId}`,
    );

    res.status(200).json({ problem });
  } catch (error: unknown) {
    logger.error(
      `Error fetching problem ID: ${req.params.problem_id} - User ID: ${req.authUser?.userId || "unknown"}: ${error instanceof Error ? error.message : error}`,
    );
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateProblem: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.authUser?.userId;
    const { problem_id } = req.params;
    const { name, difficulty, tags, date_solved, notes } = req.body;

    if (!userId) {
      logger.warn(
        `Unauthorized problem update attempt for ID: ${userId} from IP: ${req.ip}`,
      );
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    logger.info(
      `Updating transaction ID: ${problem_id} for User ID: ${userId}`,
    );

    const existingProblem = await db("problems")
      .where({ problem_id, user_id: userId })
      .first();

    if (!existingProblem) {
      logger.warn(`Problem ID: ${problem_id} not found for User ID: ${userId}`);
      res.status(404).json({ error: "Problem not found" });
      return;
    }

    const updatedFields: Record<string, any> = {};
    if (name) updatedFields.name = name;
    if (difficulty) updatedFields.difficulty = difficulty;
    if (tags) updatedFields.tags = tags;
    if (date_solved) updatedFields.date_solved = date_solved;
    if (notes) updatedFields.notes = notes;

    const [updatedProblem] = await db("problems")
      .where({ problem_id, user_id: userId })
      .update(updatedFields)
      .returning([
        "problem_id",
        "name",
        "difficulty",
        "tags",
        "date_solved",
        "notes",
        "updated_at",
      ]);

    logger.info(
      `Problem ID: ${problem_id} successfully updated for User ID: ${userId}`,
    );

    res.status(200).json({
      message: "Problem updated successfully",
      problem: updatedProblem,
    });
  } catch (error: unknown) {
    logger.error(
      `Problem update error for ID: ${req.params.problem_id} - User ID: ${req.authUser?.userId || "unknown"}: ${error instanceof Error ? error.message : error}`,
    );
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteProblem: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.authUser?.userId;
    const { problem_id } = req.params;

    if (!userId) {
      logger.warn(
        `Unauthorized problem deletion attempt for ID: ${problem_id} from IP: ${req.ip}`,
      );
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Ensure the problem exists and belongs to the authenticated user
    const existingProblem = await db("problems")
      .where({ problem_id, user_id: userId })
      .first();

    if (!existingProblem) {
      logger.warn(`Problem ID: ${problem_id} not found for User ID: ${userId}`);
      res.status(404).json({ error: "Problem not found" });
      return;
    }

    // Delete associated reminders first to maintain integrity
    await db("reminders").where({ problem_id }).del();

    // Delete the problem
    await db("problems").where({ problem_id }).del();

    logger.info(
      `Problem ID: ${problem_id} successfully deleted for User ID: ${userId}`,
    );

    res.status(200).json({ message: "Problem deleted successfully" });
  } catch (error: unknown) {
    logger.error(
      `Problem deletion error for ID: ${req.params.problem_id} - User ID: ${req.authUser?.userId || "unknown"}: ${error instanceof Error ? error.message : error}`,
    );
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handlePracticeFeedback: RequestHandler = async (
  req: AuthenticatedRequest,
  res,
) => {
  try {
    const userId = req.authUser?.userId;
    const { problem_id } = req.params;
    const { quality_score } = req.body; // 1–5

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Fetch problem & ensure ownership
    const problem = await db("problems")
      .where({ problem_id, user_id: userId })
      .first();

    if (!problem) {
      res.status(404).json({ error: "Problem not found" });
      return;
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
    await db("problems").where({ problem_id }).update({
      practice_meta: updatedMeta,
      updated_at: now,
    });

    // Create new reminder
    await db("reminders").insert({
      problem_id,
      user_id: userId,
      due_datetime: nextDue,
      created_at: now,
      updated_at: now,
    });

    logger.info(
      `Practice recorded for problem ${problem_id} (user ${userId}) — next due ${nextDue.toISOString()}`,
    );

    res.status(200).json({
      message: `Next reminder on ${nextDue.toDateString()}`,
    });
  } catch (err) {
    logger.error(`Error updating problem practice meta ${err}`);
    res.status(500).json({ error: "Internal server error" });
  }
};
