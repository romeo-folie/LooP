import { AppRequestHandler } from "../types";
import AppError from "../types/errors";
import { IReminderRow } from "../types/knex-tables";
import {
  createReminder,
  deleteReminder,
  getReminderById,
  updateReminder,
} from "../services/reminder.service";

export const handleGetReminderById: AppRequestHandler<
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

    const reminderIdNum = Number(reminder_id);
    if (!Number.isInteger(reminderIdNum) || reminderIdNum <= 0) {
      req.log?.warn("handleGetReminderById: invalid reminder_id", {
        reminder_id,
      });
      throw new AppError("BAD_REQUEST", "Invalid reminder_id");
    }

    const reminder = await getReminderById({
      userId,
      reminderId: reminderIdNum,
      log: req.log,
    });

    res.status(200).json({ reminder });
  } catch (error) {
    req.log?.error("handleGetReminderById:error", {
      userId: req.authUser?.userId ?? "unknown",
      reminder_id: req.params.reminder_id,
      message: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const handleCreateReminder: AppRequestHandler<
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

    const problemIdNum = Number(problem_id);
    if (!Number.isInteger(problemIdNum) || problemIdNum <= 0) {
      req.log?.warn("handleCreateReminder: invalid problem_id", { problem_id });
      throw new AppError("BAD_REQUEST", "Invalid problem_id");
    }

    const reminder = await createReminder({
      userId,
      problemId: problemIdNum,
      dueDatetime: due_datetime,
      log: req.log,
    });

    res.status(201).json({
      message: "Reminder created successfully",
      reminder,
    });
  } catch (error) {
    req.log?.error("handleCreateReminder:error", {
      userId: req.authUser?.userId ?? "unknown",
      problem_id: req.params.problem_id,
      message: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const handleUpdateReminder: AppRequestHandler<
  { reminder_id: string },
  { message: string; reminder: Partial<IReminderRow> },
  { due_datetime?: Date | string; is_completed?: boolean }
> = async (req, res, next) => {
  try {
    const userId = req.authUser?.userId;
    const { reminder_id } = req.params;
    const { due_datetime, is_completed } = req.body;

    if (!userId) {
      req.log?.warn(`Unauthorized reminder update attempt from IP: ${req.ip}`);
      throw new AppError("UNAUTHORIZED");
    }

    const reminderIdNum = Number(reminder_id);
    if (!Number.isInteger(reminderIdNum) || reminderIdNum <= 0) {
      req.log?.warn("handleUpdateReminder: invalid reminder_id", {
        reminder_id,
      });
      throw new AppError("BAD_REQUEST", "Invalid reminder_id");
    }

    const updated = await updateReminder({
      userId,
      reminderId: reminderIdNum,
      data: { due_datetime, is_completed },
      log: req.log,
    });

    res.status(200).json({
      message: "Reminder updated successfully",
      reminder: updated,
    });
  } catch (error) {
    req.log?.error("handleUpdateReminder:error", {
      userId: req.authUser?.userId ?? "unknown",
      reminder_id: req.params.reminder_id,
      message: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const handleDeleteReminder: AppRequestHandler<
  { reminder_id: string; problem_id: string },
  { message: string }
> = async (req, res, next) => {
  try {
    const userId = req.authUser?.userId;
    const { reminder_id } = req.params;

    if (!userId) {
      req.log?.warn(
        `Unauthorized deletion attempt for reminder ${reminder_id} from IP: ${req.ip}`,
      );
      throw new AppError("UNAUTHORIZED");
    }

    const reminderIdNum = Number(reminder_id);
    if (!Number.isInteger(reminderIdNum) || reminderIdNum <= 0) {
      req.log?.warn("handleDeleteReminder: invalid reminder_id", {
        reminder_id,
      });
      throw new AppError("BAD_REQUEST", "Invalid reminder_id");
    }

    await deleteReminder({
      userId,
      reminderId: reminderIdNum,
      log: req.log,
    });

    res.status(200).json({ message: "Reminder deleted successfully" });
  } catch (error) {
    req.log?.error("handleDeleteReminder:error", {
      userId: req.authUser?.userId ?? "unknown",
      reminder_id: req.params.reminder_id,
      message: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};
