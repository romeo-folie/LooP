import webpush from 'web-push';
import { db } from "../db";
import logger from '../config/winston-config';

async function sendPushReminder(userId: number, message: string, due_datetime: Date) {
  const subscriptions = await db('subscriptions')
    .where({ user_id: userId, is_active: true });
  
  for (const sub of subscriptions) {
    const subscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.public_key,
        auth: sub.auth
      }
    };
    const payload = JSON.stringify({ title: 'DSA Reminder', body: { message, due_datetime } });
    try {
      await webpush.sendNotification(subscription, payload);
      logger.info(`Push sent to user ${userId}`);
    } catch (error) {
      logger.error(`Failed to send push: ${error}`);
      // await db('subscriptions').where({ user_id: userId, endpoint: sub.endpoint }).update({ is_active: false });
    }
  }
}

export default sendPushReminder


