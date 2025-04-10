import { createAxiosInstance } from "@/lib/api-client";
import { ActionType, db, getMeta, ResourceType, StatusType } from "./db";
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
    const { type, resource, resourceId, retryCount, lastAttemptAt } = record;
    const { method, url } = getRoute(type, resource, resourceId);
    const delay = Math.min(2 ** retryCount * 1000, 60000);
    const now = Date.now();

    if (retryCount > 0 && now - lastAttemptAt! < delay) continue;

    try {
      await axiosInstance({
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
  resourceId: number | string,
) {
  // the update action is only performed on entities with DB assigned IDs
  if (type === ActionType.Update || type === ActionType.Delete) {
    return {
      url:
        resource === ResourceType.Problem
          ? `/problems/${resourceId as number}`
          : `/reminders/${resourceId as number}`,
      method: type,
    };
  }

  return {
    url: resource === ResourceType.Problem ? "/problems" : "/reminders",
    method: type,
  };
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
    logger.error(`Error retrieving token for background sync ${error}`);
  }
}
