import { Response, RequestHandler } from "express";
import { AuthenticatedRequest } from "../types/authenticated-request";
import { db } from "../db";
import logger from "../config/winston-config";

export const getRemindersByProblem: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.authUser?.userId;
    const { problem_id } = req.params;

    if (!userId) {
      logger.warn(`Unauthorized reminders request attempt from IP: ${req.ip}`);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    logger.info(
      `Fetching reminders for Problem ID ${problem_id} - User ID: ${userId}`,
    );

    // Ensure the problem exists and belongs to the authenticated user
    const problem = await db("problems")
      .where({ problem_id, user_id: userId })
      .first();

    if (!problem) {
      logger.warn(`Problem ID: ${problem_id} not found - User ID: ${userId}`);
      res.status(404).json({ error: "Problem not found" });
      return;
    }

    // Fetch reminders for the problem
    const reminders = await db("reminders")
      .where({ problem_id, user_id: userId })
      .select(
        "reminder_id",
        "due_datetime",
        "is_sent",
        "sent_at",
        "is_completed",
        "completed_at",
        "created_at",
      );

    logger.info(
      `Successfully fetched ${reminders.length} reminders - User ID: ${userId}`,
    );

    res.status(200).json({ reminders });
  } catch (error: unknown) {
    logger.error(
      `Error fetching reminders for Problem ID: ${req.params.problem_id} - User ID: ${req.authUser?.userId || "unknown"}: ${error instanceof Error ? error.message : error}`,
    );
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getReminderById: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.authUser?.userId;
    const { reminder_id } = req.params;

    if (!userId) {
      logger.warn(`Unauthorized reminder request attempt from IP: ${req.ip}`);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    logger.info(`Fetching reminder ID: ${reminder_id} - User ID: ${userId}`);

    // Fetch the reminder belonging to the authenticated user
    const reminder = await db("reminders")
      .where({ reminder_id, user_id: userId })
      .first();

    if (!reminder) {
      logger.warn(`Reminder ID: ${reminder_id} not found - User ID: ${userId}`);
      res.status(404).json({ error: "Reminder not found" });
      return;
    }

    logger.info(
      `Successfully fetched Reminder ID ${reminder_id} - User ID: ${userId}`,
    );

    res.status(200).json({ reminder });
  } catch (error: unknown) {
    logger.error(
      `Error fetching reminder ID: ${req.params.reminder_id} - User ID: ${req.authUser?.userId || "unknown"}: ${error instanceof Error ? error.message : error}`,
    );
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createReminder: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.authUser?.userId;
    const { problem_id } = req.params;
    const { due_datetime } = req.body;

    if (!userId) {
      logger.warn(`Unauthorized reminder creation attempt from IP: ${req.ip}`);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const existingProblem = await db("problems")
      .where({ problem_id, user_id: userId })
      .first();

    if (!existingProblem) {
      logger.warn(`Problem ID: ${problem_id} not found - User ID: ${userId}`);
      res.status(404).json({ error: "Problem not found" });
      return;
    }

    logger.info(
      `Creating reminder for User ID: ${userId} - ${JSON.stringify(req.body)}`,
    );

    const [newReminder] = await db("reminders")
      .insert({
        problem_id,
        user_id: userId,
        due_datetime,
      })
      .returning([
        "reminder_id",
        "problem_id",
        "due_datetime",
        "is_sent",
        "sent_at",
        // 'is_completed',
        // 'completed_at',
        "created_at",
      ]);

    logger.info(
      `Reminder created successfully Reminder ID: ${newReminder.id} - User ID: ${userId}`,
    );

    res.status(201).json({
      message: "Reminder created successfully",
      reminder: newReminder,
    });
  } catch (error: unknown) {
    logger.error(
      `Reminder creation error for Problem ID: ${req.params.problem_id} - User ID: ${req.authUser?.userId || "unknown"}: ${error instanceof Error ? error.message : error}`,
    );
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateReminder: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.authUser?.userId;
    const { reminder_id } = req.params;
    const { due_datetime, is_completed } = req.body;

    if (!userId) {
      logger.warn(
        `Unauthorized reminder update attempt for ID: ${userId} from IP: ${req.ip}`,
      );
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const existingReminder = await db("reminders")
      .where({ reminder_id, user_id: userId })
      .first();

    if (!existingReminder) {
      logger.warn(
        `Reminder ID: ${reminder_id} not found for User ID: ${userId}`,
      );
      res.status(404).json({ error: "Reminder not found" });
      return;
    }

    const updatedFields: Record<string, any> = {};
    if (due_datetime) updatedFields.due_datetime = due_datetime;
    if (is_completed !== undefined) {
      updatedFields.is_completed = is_completed;
      updatedFields.completed_at = is_completed ? new Date() : null;
    }

    const [updatedReminder] = await db("reminders")
      .where({ reminder_id, user_id: userId })
      .update(updatedFields)
      .returning([
        "reminder_id",
        "problem_id",
        "due_datetime",
        "is_sent",
        "sent_at",
        // 'is_completed',
        // 'completed_at',
        "updated_at",
      ]);

    logger.info(
      `Reminder ID: ${reminder_id} successfully updated - User ID: ${userId}`,
    );

    res.status(200).json({
      message: "Reminder updated successfully",
      reminder: updatedReminder,
    });
  } catch (error: unknown) {
    logger.error(
      `Reminder update error for ID: ${req.params.reminder_id} - User ID: ${req.authUser?.userId || "unknown"}: ${error instanceof Error ? error.message : error}`,
    );
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteReminder: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.authUser?.userId;
    const { reminder_id } = req.params;

    if (!userId) {
      logger.warn(
        `Unauthorized deletion attempt reminder ID: ${reminder_id} from IP: ${req.ip}`,
      );
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Ensure the reminder exists and belongs to the authenticated user
    const existingReminder = await db("reminders")
      .where({ reminder_id, user_id: userId })
      .first();

    if (!existingReminder) {
      logger.warn(`Reminder ID: ${reminder_id} not found - User ID: ${userId}`);
      res.status(404).json({ error: "Reminder not found" });
      return;
    }

    // Delete the reminder
    await db("reminders").where({ reminder_id }).del();

    logger.info(
      `Reminder ID: ${reminder_id} successfully deleted - User ID: ${userId}`,
    );

    res.status(200).json({ message: "Reminder deleted successfully" });
  } catch (error: unknown) {
    logger.error(
      `Reminder deletion error for ID: ${req.params.problem_id} - User ID: ${req.authUser?.userId || "unknown"}: ${error instanceof Error ? error.message : error}`,
    );
    res.status(500).json({ error: "Internal server error" });
  }
};
