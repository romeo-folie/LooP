import webpush from "web-push";
import { db } from "../db";
import logger from "../config/winston-config";

async function sendPushReminder(
  userId: number,
  message: string,
  meta: { due_datetime: Date; problem_id: number }
) {
  const subscriptions = await db("subscriptions").where({
    user_id: userId,
    is_active: true,
  });

  for (const sub of subscriptions) {
    const subscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.public_key,
        auth: sub.auth,
      },
    };
    const payload = JSON.stringify({
      title: "DSA Revision Reminder",
      body: { message, meta },
    });
    try {
      await webpush.sendNotification(subscription, payload);
      logger.info(`Push sent to user ${userId}`);
    } catch (error: any) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        await db("subscriptions")
          .where({ endpoint: subscription.endpoint })
          .del();
      }
      logger.error(`Failed to send push: ${error.body}`);
    }
  }
}

export default sendPushReminder;
