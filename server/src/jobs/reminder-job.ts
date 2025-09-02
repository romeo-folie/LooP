import { db } from "../db";
import logger from "../config/winston-config";
import sendPushReminder from "../lib/send-push-reminder";

export default async function reminderJob() {
  try {
    const now = new Date();
    logger.info("Checking for due reminders...");

    const dueReminders = await db("reminders")
      .join("problems", "reminders.problem_id", "problems.problem_id")
      .where("reminders.is_sent", false)
      .where("reminders.due_datetime", "<=", now)
      .select<
        {
          reminder_id: number;
          problem_id: number;
          user_id: number;
          problem_name: string;
          due_datetime: Date;
          due_datetime_ms: number;
        }[]
      >("reminders.reminder_id", "reminders.problem_id", "reminders.user_id", "problems.name as problem_name", db.raw("FLOOR(EXTRACT(EPOCH FROM reminders.due_datetime) * 1000)::double precision AS due_datetime_ms"));

    if (dueReminders.length === 0) {
      logger.info("No due reminders found.");
      return;
    }

    logger.info(`Found ${dueReminders.length} reminders due`);

    for (const reminder of dueReminders) {
      await sendPushReminder(
        reminder.user_id,
        `Time to revisit: ${reminder.problem_name}`,
        {
          due_datetime: reminder.due_datetime_ms,
          problem_id: reminder.problem_id,
        },
      );
    }

    const reminderIds = dueReminders.map((r) => r.reminder_id);
    await db("reminders").whereIn("reminder_id", reminderIds).update({
      is_sent: true,
      sent_at: now,
      updated_at: now,
    });

    logger.info(`Marked ${dueReminders.length} reminders as sent.`);
  } catch (error) {
    logger.error("Error processing due reminders", error);
  }
}
