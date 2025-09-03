import webpush, { WebPushError } from "web-push";
import { db } from "../db";
import logger from "../lib/winston-config";

async function sendPushReminder(
  userId: number,
  message: string,
  meta: { due_datetime: number; problem_id: number },
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
    } catch (error: unknown) {
      if (error instanceof WebPushError) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          await db("subscriptions")
            .where({ endpoint: subscription.endpoint })
            .del();
        }
        logger.error(`WebPushError: ${error.body}`);
      }
      logger.error(`Failed to send push: ${error}`);
    }
  }
}

export default sendPushReminder;
