import { Knex } from "knex";
import { Logger } from "winston";
import { subscriptionsRepo } from "../repositories/subscription.repo";
import AppError from "../types/errors";
import { ISubscriptionRow } from "../types/knex-tables";

type UpsertArgs = {
  userId: number;
  endpoint: string;
  publicKey: string;
  auth: string;
  log?: Logger;
  trx?: Knex.Transaction;
};

type UpsertResult = {
  subscription: ISubscriptionRow;
  created: boolean;
};

type DeleteArgs = {
  userId: number;
  endpoint: string;
  log?: Logger;
  trx?: Knex.Transaction;
};

export async function upsertSubscription({
  userId,
  endpoint,
  publicKey,
  auth,
  log,
  trx,
}: UpsertArgs): Promise<UpsertResult> {
  if (!userId) throw new AppError("UNAUTHORIZED");

  if (!endpoint || !publicKey || !auth) {
    throw new AppError(
      "BAD_REQUEST",
      "endpoint, public_key and auth are required",
    );
  }

  const existing = await subscriptionsRepo.findByUserAndEndpoint(
    userId,
    endpoint,
    trx,
  );

  if (existing) {
    const updated = await subscriptionsRepo.updateById(
      existing.subscription_id,
      { public_key: publicKey, auth },
      trx,
    );
    log?.info("upsertSubscription:updated", {
      userId,
      subscriptionId: updated.subscription_id,
    });
    return { subscription: updated, created: false };
  }

  // Create new subscription
  try {
    const created = await subscriptionsRepo.insert(
      { user_id: userId, endpoint, public_key: publicKey, auth },
      trx,
    );
    log?.info("upsertSubscription:created", {
      userId,
      subscriptionId: created.subscription_id,
    });
    return { subscription: created, created: true };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    // Handle unique constraint on endpoint (schema has endpoint UNIQUE)
    if (err?.code === "23505") {
      // Endpoint already exists (likely tied to another user or duplicate)
      throw new AppError("CONFLICT", "This device is already subscribed");
    }
    throw err;
  }
}

export async function deleteSubscription({
  userId,
  endpoint,
  log,
  trx,
}: DeleteArgs): Promise<void> {
  if (!userId) throw new AppError("UNAUTHORIZED");
  if (!endpoint) throw new AppError("BAD_REQUEST", "endpoint is required");

  const deleted = await subscriptionsRepo.deleteByUserAndEndpoint(
    userId,
    endpoint,
    trx,
  );

  if (deleted === 0) {
    log?.warn("deleteSubscription:not_found", { userId, endpoint });
    throw new AppError("NOT_FOUND", "Subscription not found");
  }

  log?.info("deleteSubscription:success", { userId, endpoint });
}
