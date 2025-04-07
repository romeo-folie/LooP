import { createAxiosInstance } from "@/hooks/use-axios";
import { ActionType, db, ResourceType, StatusType } from "./db";
import { logger } from "./logger";
import browserStore from "./browser-storage";
import { decrypt } from "./web-crypto";

export default async function syncOutbox() {
  const records = await db.outbox.toArray();
  logger.info(`outbox record count: ${records.length}`);

  const accessToken = await retrieveToken();
  logger.info("decrypted access token ", accessToken);
  const axiosInstance = createAxiosInstance(accessToken);
  logger.info(`AXIOS INSTANCE ${axiosInstance.defaults}`);

  for (const record of records) {
    const { type, resource, retryCount, lastAttemptAt } = record;
    const { method, url } = getRoute(type, resource);
    const delay = Math.min(2 ** retryCount * 1000, 60000);
    const now = Date.now();

    if (retryCount > 0 && now - lastAttemptAt! < delay) continue;

    try {
      await axiosInstance({
        method,
        url,
      });
      await db.outbox.delete(record.id);
      logger.info(
        `successfully synced ${resource as string} with id ${record.id}`
      );
    } catch (error) {
      logger.error(
        `failed to sync ${resource as string} with id ${record.id}, error: ${error}`,
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

function getRoute(type: ActionType, resource: ResourceType) {
  return {
    url: resource === ResourceType.Problem ? "/problems" : "/reminders",
    method: type,
  };
}

async function retrieveToken() {
  const user = browserStore.get("user");
  const key = browserStore.get("exportedKey");
  const decryptionKey = await window.crypto.subtle.importKey(
    "jwk",
    key,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
  const token = await decrypt(
    { iv: user.iv, ciphertext: user.token },
    decryptionKey
  );
  logger.info(`Decrypted access token ${token}`);
  return token;
}
