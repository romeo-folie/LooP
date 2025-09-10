import { Logger } from "winston";
import { problemsRepo } from "../repositories/problem.repo";
import { remindersRepo } from "../repositories/reminder.repo";
import AppError from "../types/errors";
import { IReminderRow } from "../types/knex-tables";
import { Knex } from "knex";

type CreateReminderArgs = {
  userId: number;
  problemId: number;
  dueDatetime: Date | string;
  log?: Logger;
  trx?: Knex.Transaction;
};

type GetReminderByIdArgs = {
  userId: number;
  reminderId: number;
  log?: Logger;
  trx?: Knex.Transaction;
};

type GetRemindersByProblemArgs = {
  userId: number;
  problemId: number;
  log?: Logger;
  trx?: Knex.Transaction;
};

type UpdateReminderArgs = {
  userId: number;
  reminderId: number;
  data: {
    due_datetime?: Date | string;
    is_completed?: boolean;
  };
  log?: Logger;
  trx?: Knex.Transaction;
};

type DeleteReminderArgs = {
  userId: number;
  reminderId: number;
  log?: Logger;
  trx?: Knex.Transaction;
};

export async function getReminderById({
  userId,
  reminderId,
  log,
  trx,
}: GetReminderByIdArgs): Promise<IReminderRow> {
  if (!userId) throw new AppError("UNAUTHORIZED");

  log?.info("getReminderById:start", { userId, reminderId });

  const reminder = await remindersRepo.findByIdForUser(reminderId, userId, trx);
  if (!reminder) {
    log?.warn("getReminderById:not_found", { userId, reminderId });
    throw new AppError("NOT_FOUND", "Reminder not found");
  }

  log?.info("getReminderById:success", { userId, reminderId });
  return reminder;
}

export async function getRemindersByProblemId({
  userId,
  problemId,
  log,
  trx,
}: GetRemindersByProblemArgs): Promise<Partial<IReminderRow>[]> {
  if (!userId) throw new AppError("UNAUTHORIZED");

  log?.info("getRemindersByProblemId:start", { userId, problemId });

  const problem = await problemsRepo.findById(userId, problemId, trx);
  if (!problem) {
    log?.warn("getRemindersByProblemId:not_found", { userId, problemId });
    throw new AppError("NOT_FOUND", "Problem not found");
  }

  const reminders = await remindersRepo.listByProblemAndUser(
    problemId,
    userId,
    trx,
  );

  log?.info("getRemindersByProblemId:success", {
    userId,
    problemId,
    count: reminders.length,
  });

  return reminders;
}

export async function createReminder({
  userId,
  problemId,
  dueDatetime,
  log,
  trx,
}: CreateReminderArgs): Promise<IReminderRow> {
  if (!userId) throw new AppError("UNAUTHORIZED");

  // Validate date
  const due = new Date(dueDatetime);
  if (Number.isNaN(due.getTime())) {
    throw new AppError("BAD_REQUEST", "Invalid due_datetime");
  }

  // Ensure problem belongs to user
  const problem = await problemsRepo.findById(userId, problemId, trx);
  if (!problem) {
    throw new AppError("NOT_FOUND", "Problem not found");
  }

  log?.info("createReminder:start", {
    userId,
    problemId,
    due_datetime: due.toISOString(),
  });

  const reminder = await remindersRepo.insertOne(
    {
      problem_id: problemId,
      user_id: userId,
      due_datetime: due,
    },
    trx,
  );

  log?.info("createReminder:success", {
    userId,
    reminder_id: reminder.reminder_id,
    problemId,
  });

  return reminder;
}

export async function updateReminder({
  userId,
  reminderId,
  data,
  log,
  trx,
}: UpdateReminderArgs): Promise<IReminderRow> {
  if (!userId) throw new AppError("UNAUTHORIZED");

  log?.info("updateReminder:start", { userId, reminderId, data });

  // Ensure ownership / existence
  const existing = await remindersRepo.findByIdForUser(reminderId, userId, trx);
  if (!existing) {
    log?.warn("updateReminder:not_found", { userId, reminderId });
    throw new AppError("NOT_FOUND", "Reminder not found");
  }

  // Build patch (only allowed fields)
  const patch: Partial<
    Pick<IReminderRow, "due_datetime" | "is_completed" | "completed_at">
  > = {};
  const now = new Date();

  if (data.due_datetime !== undefined) {
    const due = new Date(data.due_datetime);
    if (Number.isNaN(due.getTime())) {
      throw new AppError("BAD_REQUEST", "Invalid due_datetime");
    }
    patch.due_datetime = due;
  }

  if (data.is_completed !== undefined) {
    patch.is_completed = data.is_completed;
    patch.completed_at = data.is_completed ? now : null;
  }

  if (Object.keys(patch).length === 0) {
    throw new AppError("BAD_REQUEST", "No updatable fields provided");
  }

  const updated = await remindersRepo.updateByIdForUser(
    reminderId,
    userId,
    patch,
    trx,
  );

  log?.info("updateReminder:success", { userId, reminderId });
  return updated;
}

export async function deleteReminder({
  userId,
  reminderId,
  log,
  trx,
}: DeleteReminderArgs): Promise<void> {
  if (!userId) throw new AppError("UNAUTHORIZED");

  log?.info("deleteReminder:start", { userId, reminderId });

  // Ensure it exists & belongs to user (explicit check keeps error semantics clear)
  const existing = await remindersRepo.findByIdForUser(reminderId, userId, trx);
  if (!existing) {
    log?.warn("deleteReminder:not_found", { userId, reminderId });
    throw new AppError("NOT_FOUND", "Reminder not found");
  }

  const deleted = await remindersRepo.deleteByIdForUser(
    reminderId,
    userId,
    trx,
  );
  if (deleted === 0) {
    // race condition: was removed between check & delete
    log?.warn("deleteReminder:raced", { userId, reminderId });
    throw new AppError("NOT_FOUND", "Reminder not found");
  }

  log?.info("deleteReminder:success", { userId, reminderId });
}
