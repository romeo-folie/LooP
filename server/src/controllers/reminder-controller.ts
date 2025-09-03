import { db } from "../db";
import logger from "../lib/winston-config";
import { AppRequestHandler } from "../types";
import AppError from "../types/errors";
import { IProblemRow, IReminderRow } from "../types/knex-tables";

export const getRemindersByProblem: AppRequestHandler<
  { problem_id: string },
  { reminders: Partial<IReminderRow>[] }
> = async (req, res, next) => {
  try {
    const userId = req.authUser?.userId;
    const { problem_id } = req.params;

    if (!userId) {
      req.log?.warn(
        `Unauthorized reminders request attempt from IP: ${req.ip}`,
      );
      throw new AppError("UNAUTHORIZED");
    }

    req.log?.info(
      `Fetching reminders for Problem ID ${problem_id} - User ID: ${userId}`,
    );

    // Ensure the problem exists and belongs to the authenticated user
    const problem = await db("problems")
      .where({ problem_id: parseInt(problem_id), user_id: userId })
      .first();

    if (!problem) {
      req.log?.warn(`Problem ID: ${problem_id} not found - User ID: ${userId}`);
      throw new AppError("NOT_FOUND", "Problem not found");
    }

    // Fetch reminders for the problem
    const reminders = await db<IReminderRow>("reminders")
      .where({ problem_id: parseInt(problem_id), user_id: userId })
      .select(
        "reminder_id",
        "due_datetime",
        "is_sent",
        "sent_at",
        "is_completed",
        "completed_at",
        "created_at",
      );

    req.log?.info(
      `Successfully fetched ${reminders.length} reminders - User ID: ${userId}`,
    );

    res.status(200).json({ reminders });
  } catch (error: unknown) {
    req.log?.error(
      `Error fetching reminders for Problem ID: ${req.params.problem_id} - User ID: ${req.authUser?.userId || "unknown"}: ${error instanceof Error ? error.message : error}`,
    );
    next(error);
  }
};

export const getReminderById: AppRequestHandler<
  { reminder_id: string },
  { reminder: IReminderRow }
> = async (req, res, next) => {
  try {
    const userId = req.authUser?.userId;
    const { reminder_id } = req.params;

    if (!userId) {
      req.log?.warn(`Unauthorized reminder request attempt from IP: ${req.ip}`);
      throw new AppError("UNAUTHORIZED");
    }

    req.log?.info(`Fetching reminder ID: ${reminder_id} - User ID: ${userId}`);

    // Fetch the reminder belonging to the authenticated user
    const reminder = await db("reminders")
      .where({ reminder_id: parseInt(reminder_id), user_id: userId })
      .first();

    if (!reminder) {
      req.log?.warn(
        `Reminder ID: ${reminder_id} not found - User ID: ${userId}`,
      );
      throw new AppError("NOT_FOUND", "Reminder not found");
    }

    req.log?.info(
      `Successfully fetched Reminder ID ${reminder_id} - User ID: ${userId}`,
    );

    res.status(200).json({ reminder });
  } catch (error: unknown) {
    req.log?.error(
      `Error fetching reminder ID: ${req.params.reminder_id} - User ID: ${req.authUser?.userId || "unknown"}: ${error instanceof Error ? error.message : error}`,
    );
    next(error);
  }
};

export const createReminder: AppRequestHandler<
  { problem_id: string },
  { message: string; reminder: Partial<IReminderRow> },
  { due_datetime: Date }
> = async (req, res, next) => {
  try {
    const userId = req.authUser?.userId;
    const { problem_id } = req.params;
    const { due_datetime } = req.body;

    if (!userId) {
      req.log?.warn(
        `Unauthorized reminder creation attempt from IP: ${req.ip}`,
      );
      throw new AppError("UNAUTHORIZED");
    }

    const existingProblem = await db<IProblemRow>("problems")
      .where({ problem_id: parseInt(problem_id), user_id: userId })
      .first();

    if (!existingProblem) {
      req.log?.warn(`Problem ID: ${problem_id} not found - User ID: ${userId}`);
      throw new AppError("NOT_FOUND", "Problem not found");
    }

    req.log?.info(
      `Creating reminder for User ID: ${userId} - ${JSON.stringify(req.body)}`,
    );

    const [newReminder] = await db("reminders")
      .insert({
        problem_id: parseInt(problem_id),
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

    if (!newReminder) {
      req.log?.error(`Failed to create reminder for user ID  ${userId}`);
      throw new Error(`Failed to create reminder record`);
    }

    req.log?.info(
      `Reminder created successfully Reminder ID: ${newReminder.reminder_id} - User ID: ${userId}`,
    );

    res.status(201).json({
      message: "Reminder created successfully",
      reminder: newReminder,
    });
  } catch (error: unknown) {
    req.log?.error(
      `Reminder creation error for Problem ID: ${req.params.problem_id} - User ID: ${req.authUser?.userId || "unknown"}: ${error instanceof Error ? error.message : error}`,
    );
    next(error);
  }
};

export const updateReminder: AppRequestHandler<
  { reminder_id: string },
  { message: string; reminder: Partial<IReminderRow> },
  { due_datetime: Date; is_completed: boolean }
> = async (req, res, next) => {
  try {
    const userId = req.authUser?.userId;
    const { reminder_id } = req.params;
    const { due_datetime, is_completed } = req.body;

    if (!userId) {
      req.log?.warn(
        `Unauthorized reminder update attempt for ID: ${userId} from IP: ${req.ip}`,
      );
      throw new AppError("UNAUTHORIZED");
    }

    const existingReminder = await db("reminders")
      .where({ reminder_id: parseInt(reminder_id), user_id: userId })
      .first();

    if (!existingReminder) {
      req.log?.warn(
        `Reminder ID: ${reminder_id} not found for User ID: ${userId}`,
      );
      throw new AppError("NOT_FOUND", "Reminder not found");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedFields: Record<string, any> = {};
    if (due_datetime) updatedFields.due_datetime = due_datetime;
    if (is_completed !== undefined) {
      updatedFields.is_completed = is_completed;
      updatedFields.completed_at = is_completed ? new Date() : null;
    }

    const [updatedReminder] = await db("reminders")
      .where({ reminder_id: parseInt(reminder_id), user_id: userId })
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

    if (!updatedReminder) {
      req.log?.error(`Failed to update reminder for User ID: ${userId}`);
      throw new Error("Failed to update reminder");
    }

    req.log?.info(
      `Reminder ID: ${reminder_id} successfully updated - User ID: ${userId}`,
    );

    res.status(200).json({
      message: "Reminder updated successfully",
      reminder: updatedReminder,
    });
  } catch (error: unknown) {
    req.log?.error(
      `Reminder update error for ID: ${req.params.reminder_id} - User ID: ${req.authUser?.userId || "unknown"}: ${error instanceof Error ? error.message : error}`,
    );
    next(error);
  }
};

export const deleteReminder: AppRequestHandler<
  { reminder_id: string; problem_id: string },
  { message: string }
> = async (req, res, next) => {
  try {
    const userId = req.authUser?.userId;
    const { reminder_id } = req.params;

    if (!userId) {
      req.log?.warn(
        `Unauthorized deletion attempt reminder ID: ${reminder_id} from IP: ${req.ip}`,
      );
      throw new AppError("UNAUTHORIZED");
    }

    // Ensure the reminder exists and belongs to the authenticated user
    const existingReminder = await db("reminders")
      .where({ reminder_id: parseInt(reminder_id), user_id: userId })
      .first();

    if (!existingReminder) {
      req.log?.warn(
        `Reminder ID: ${reminder_id} not found - User ID: ${userId}`,
      );
      throw new AppError("NOT_FOUND", "Reminder not found");
    }

    // Delete the reminder
    await db("reminders")
      .where({ reminder_id: parseInt(reminder_id) })
      .del();

    req.log?.info(
      `Reminder ID: ${reminder_id} successfully deleted - User ID: ${userId}`,
    );

    res.status(200).json({ message: "Reminder deleted successfully" });
  } catch (error: unknown) {
    req.log?.error(
      `Reminder deletion error for ID: ${req.params.problem_id} - User ID: ${req.authUser?.userId || "unknown"}: ${error instanceof Error ? error.message : error}`,
    );
    next(error);
  }
};
