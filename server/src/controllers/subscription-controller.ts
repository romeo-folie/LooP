/* eslint-disable @typescript-eslint/no-empty-object-type */
import { db } from "../db";
import { AppRequestHandler } from "../types";
import AppError from "../types/errors";
import { ISubscriptionRow } from "../types/knex-tables";

export const createSubscription: AppRequestHandler<
  {},
  { message: string; subscription?: Partial<ISubscriptionRow> },
  { endpoint: string; public_key: string; auth: string }
> = async (req, res, next) => {
  try {
    const userId = req.authUser?.userId;
    const { endpoint, public_key, auth } = req.body;

    if (!userId) {
      req.log?.warn("Unauthorized access attempt to POST /subscriptions");
      throw new AppError("UNAUTHORIZED");
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

      req.log?.info(`Subscription updated for user ${userId}`, { endpoint });
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

      if (!newSubscription) {
        req.log?.error(`Failed to create subscription for user ${userId}`);
        throw new Error("Failed to create subscription");
      }

      req.log?.info(`New subscription created for user ${userId}`, {
        subscription_id: newSubscription.subscription_id,
      });
      res.status(201).json({
        message: "Subscription created successfully",
        subscription: newSubscription,
      });
    }
  } catch (error: unknown) {
    req.log?.error(`Error in POST /subscriptions ${error}`);
    next(error);
  }
};

export const deleteSubscription: AppRequestHandler<
  {},
  { message: string },
  { endpoint: string }
> = async (req, res, next) => {
  try {
    const userId = req.authUser?.userId;
    const { endpoint } = req.body;

    if (!userId) {
      req.log?.warn("Unauthorized access attempt to DELETE /subscriptions");
      throw new AppError("UNAUTHORIZED");
    }

    // 2. Check if the subscription exists
    const existingSubscription = await db("subscriptions")
      .where({ user_id: userId, endpoint })
      .first();

    if (!existingSubscription) {
      req.log?.warn(
        `Subscription not found for user ${userId} with endpoint ${endpoint}`,
      );
      throw new AppError("NOT_FOUND", "Subscription not found");
    }

    // 3. Delete the subscription
    await db("subscriptions")
      .where({ subscription_id: existingSubscription.subscription_id })
      .del();

    req.log?.info(`Subscription deleted for user ${userId}`, {
      subscription_id: existingSubscription.subscription_id,
    });
    res.status(200).json({ message: "Subscription deleted successfully" });
  } catch (error: unknown) {
    req.log?.error(`Error in DELETE /subscriptions, ${error}`);
    next(error);
  }
};
