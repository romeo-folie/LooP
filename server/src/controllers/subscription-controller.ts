/* eslint-disable @typescript-eslint/no-empty-object-type */
import { db } from "../db";
import logger from "../config/winston-config";
import { AppRequestHandler } from "../types";
import { ISubscriptionRow } from "../types/knex-tables";

export const createSubscription: AppRequestHandler<
  {},
  { message: string; subscription?: Partial<ISubscriptionRow> },
  { endpoint: string; public_key: string; auth: string }
> = async (req, res) => {
  try {
    const userId = req.authUser?.userId;
    const { endpoint, public_key, auth } = req.body;

    if (!userId) {
      logger.warn("Unauthorized access attempt to POST /subscriptions");
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // 2. Check if the subscription already exists for the same user & endpoint
    const existingSubscription = await db("subscriptions")
      .where({ user_id: userId, endpoint })
      .first();

    if (existingSubscription) {
      // 3. Update existing subscription if found
      await db("subscriptions")
        .where({ subscription_id: existingSubscription.subscription_id })
        .update({ public_key, auth, updated_at: new Date() });

      logger.info(`Subscription updated for user ${userId}`, { endpoint });
      res.status(200).json({ message: "Subscription updated successfully" });
    } else {
      // 4. Insert new subscription
      const [newSubscription] = await db("subscriptions")
        .insert({
          user_id: userId,
          endpoint,
          public_key,
          auth,
        })
        .returning(["subscription_id", "user_id", "endpoint", "created_at"]);

      if (!newSubscription) throw new Error("failed to create subscription");

      logger.info(`New subscription created for user ${userId}`, {
        subscription_id: newSubscription.subscription_id,
      });
      res.status(201).json({
        message: "Subscription created successfully",
        subscription: newSubscription,
      });
    }
  } catch (error: unknown) {
    logger.error(`Error in POST /subscriptions ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteSubscription: AppRequestHandler<
  {},
  { message: string },
  { endpoint: string }
> = async (req, res) => {
  try {
    const userId = req.authUser?.userId;
    const { endpoint } = req.body;

    if (!userId) {
      logger.warn("Unauthorized access attempt to DELETE /subscriptions");
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // 2. Check if the subscription exists
    const existingSubscription = await db("subscriptions")
      .where({ user_id: userId, endpoint })
      .first();

    if (!existingSubscription) {
      logger.warn(
        `Subscription not found for user ${userId} with endpoint ${endpoint}`,
      );
      res.status(404).json({ error: "Subscription not found" });
      return;
    }

    // 3. Delete the subscription
    await db("subscriptions")
      .where({ subscription_id: existingSubscription.subscription_id })
      .del();

    logger.info(`Subscription deleted for user ${userId}`, {
      subscription_id: existingSubscription.subscription_id,
    });
    res.status(200).json({ message: "Subscription deleted successfully" });
  } catch (error: unknown) {
    logger.error(`Error in DELETE /subscriptions, ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
};
