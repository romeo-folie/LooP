import { createAxiosInstance } from "@/lib/api-client";
import {
  ActionType,
  db,
  getMeta,
  ProblemSchema,
  ReminderSchema,
  ResourceType,
  StatusType,
} from "./db";
import { logger } from "./logger";
import { decrypt } from "./web-crypto";
import { User } from "@/context/auth-provider";

export default async function syncOutbox() {
  const records = await db.outbox.toArray();
  logger.info(`outbox record count: ${records.length}`);
  if (!records.length) return;

  const tokens = await retrieveTokens();
  if (!tokens) return;
  const axiosInstance = createAxiosInstance(
    tokens.accessToken,
    tokens.csrfToken
  );

  for (const record of records) {
    const { type, resource, resourceId, payload, retryCount, lastAttemptAt } =
      record;
    const { method, url } = getRoute(type, resource, payload, resourceId);
    const delay = Math.min(2 ** retryCount * 1000, 60000);
    const now = Date.now();

    if (retryCount > 0 && now - lastAttemptAt! < delay) continue;

    try {
      await axiosInstance({
        headers: { "X-SYNC-ORIGIN": "service-worker" },
        method,
        url,
        data: record.payload,
      });
      await db.outbox.delete(record.id);
      logger.info(
        `successfully synced ${resource as string} with id ${record.id}`
      );
    } catch (error) {
      logger.error(
        `failed to sync ${resource as string} with id ${
          record.id
        }, error: ${error}`
      );
      await db.outbox.update(record.id, {
        ...record,
        status: StatusType.Failed,
        retryCount: (retryCount || 0) + 1,
        lastAttemptAt: now,
      });
    }
  }
}

function getRoute(
  type: ActionType,
  resource: ResourceType,
  payload: ProblemSchema | ReminderSchema,
  resourceId: number | string
) {
  if (resource === ResourceType.Problem) {
    if (type === ActionType.Create) {
      return { url: "/problems", method: type };
    }

    return { url: `/problems/${resourceId as number}`, method: type };
  } else {
    if (type === ActionType.Create) {
      return {
        url: `/reminders/${(payload as ReminderSchema).problem_id as number}`,
        method: type,
      };
    }

    return {
      url: `/reminders/${(payload as ReminderSchema).reminder_id as number}`,
      method: type,
    };
  }
}

async function retrieveTokens() {
  try {
    const user = (await getMeta("user")) as User;
    const key = await getMeta("exportedKey");
    if (!user || !key) throw new Error("Failed to retrieve local user and key");
    const decryptionKey = await crypto.subtle.importKey(
      "jwk",
      key,
      {
        name: "AES-GCM",
        length: 256,
      },
      true,
      ["encrypt", "decrypt"]
    );
    const token = await decrypt(
      { iv: user.iv!, ciphertext: user.token as Uint8Array<ArrayBuffer> },
      decryptionKey
    );
    return { accessToken: token, csrfToken: user.csrfToken as string };
  } catch (error) {
    logger.error(`Error retrieving tokens for background sync ${error}`);
  }
}
