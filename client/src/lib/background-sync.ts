import axios from "axios";
import { ActionType, db, ResourceType, StatusType } from "./db";
import { logger } from "./logger";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_SERVER_URL,
  withCredentials: true,
});

export default async function syncOutbox() {
  const records = await db.outbox.toArray();

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
        `failed to sync ${resource as string} with id ${record.id}`,
        error
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
  if (resource === ResourceType.Problem) {
    return { url: "/problems", method: type };
  }
  return { url: "/reminders", method: type };
}
