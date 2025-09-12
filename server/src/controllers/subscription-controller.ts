/* eslint-disable @typescript-eslint/no-empty-object-type */
import {
  deleteSubscription,
  upsertSubscription,
} from "../services/subscription.service";
import { AppRequestHandler } from "../types";
import AppError from "../types/errors";
import { ISubscriptionRow } from "../types/knex-tables";

export const handleCreateSubscription: AppRequestHandler<
  {},
  { message: string; subscription?: Partial<ISubscriptionRow> },
  { endpoint: string; public_key: string; auth: string }
> = async (req, res, next) => {
  try {
    const userId = req.authUser?.userId;
    const { endpoint, public_key, auth } = req.body ?? {};

    if (!userId) {
      req.log?.warn("Unauthorized access attempt to POST /subscriptions");
      throw new AppError("UNAUTHORIZED");
    }

    const { subscription, created } = await upsertSubscription({
      userId,
      endpoint,
      publicKey: public_key,
      auth,
      log: req.log,
    });

    if (created) {
      res.status(201).json({
        message: "Subscription created successfully",
        subscription: {
          subscription_id: subscription.subscription_id,
          user_id: subscription.user_id,
          endpoint: subscription.endpoint,
          created_at: subscription.created_at,
        },
      });
    } else {
      res.status(200).json({
        message: "Subscription updated successfully",
        subscription: {
          subscription_id: subscription.subscription_id,
          user_id: subscription.user_id,
          endpoint: subscription.endpoint,
          updated_at: subscription.updated_at,
        },
      });
    }
  } catch (error) {
    req.log?.error("handleCreateSubscription:error", {
      userId: req.authUser?.userId ?? "unknown",
      message: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const handleDeleteSubscription: AppRequestHandler<
  {},
  { message: string },
  { endpoint: string }
> = async (req, res, next) => {
  try {
    const userId = req.authUser?.userId;
    const { endpoint } = req.body ?? {};

    if (!userId) {
      req.log?.warn("Unauthorized access attempt to DELETE /subscriptions");
      throw new AppError("UNAUTHORIZED");
    }

    await deleteSubscription({ userId, endpoint, log: req.log });

    req.log?.info("handleDeleteSubscription:success", { userId, endpoint });

    res.status(200).json({ message: "Subscription deleted successfully" });
  } catch (error) {
    req.log?.error("handleDeleteSubscription:error", {
      userId: req.authUser?.userId ?? "unknown",
      endpoint: req.body?.endpoint,
      message: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};
