import Dexie, { EntityTable } from "dexie";
import {
  AppQueryFilters,
  PageShape,
  ProblemResponse,
  ReminderResponse,
} from "@/pages/problems/ProblemDashboard";
import { isNumber, isString } from "lodash";
import type { Notification } from "@/context/notification-provider";
import { logger } from "./logger";
import { format } from "date-fns";
import { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";

export enum ActionType {
  Create = "POST",
  Update = "PUT",
  Delete = "DELETE",
}

export enum StatusType {
  Pending = "PENDING",
  Failed = "FAILED",
  Synced = "SYNCED",
}

export enum ResourceType {
  Problem = "Problem",
  Reminder = "Reminder",
}

export type ProblemSchema = Partial<ProblemResponse>;

export type ReminderSchema = Partial<ReminderResponse>;

export type NotificationSchema = Notification & {
  problem_id: number;
  due_datetime: number;
};

type Payload = ProblemSchema | ReminderSchema;

interface OutboxSchema {
  id: number;
  type: ActionType;
  resource: ResourceType;
  resourceId: string | number;
  payload: Payload;
  status: StatusType;
  createdAt: number;
  retryCount: number;
  lastAttemptAt?: number;
}

interface MetaSchema {
  key: string;
  value: unknown;
}

export const db = new Dexie("loopDB") as Dexie & {
  problems: EntityTable<ProblemSchema, "id">;
  outbox: EntityTable<OutboxSchema, "id">;
  meta: EntityTable<MetaSchema, "key">;
  notifications: EntityTable<NotificationSchema, "problem_id">;
};

db.version(1).stores({
  problems:
    "++id, &problem_id, user_id, local_id, name, difficulty, *tags, date_solved, notes, reminders, isOffline, created_at, created_at_millis",
  outbox:
    "++id, type, resource, resourceId, payload, status, createdAt, lastAttemptAt",
  meta: "key",
  notifications: "problem_id, title, body, due_datetime",
});

function chunkArray<T>(arr: T[], size = 10): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export async function getProblemsPageFromDB(
  filters: AppQueryFilters,
  page = 1,
  pageSize = 10,
): Promise<PageShape> {
  // base collection sorted by created_at desc
  let collection = db.problems.orderBy("created_at").reverse();

  if (filters.difficulty) {
    collection = collection.filter(
      (p: ProblemSchema) => p.difficulty === filters.difficulty,
    );
  }
  if (filters.date_solved) {
    const target = filters.date_solved; // "yyyy-MM-dd"
    collection = collection.filter((p: ProblemSchema) =>
      p.date_solved
        ? format(new Date(p.date_solved), "yyyy-MM-dd") === target
        : false,
    );
  }

  if (filters.tag) {
    const tagLower = filters.tag.toLowerCase();
    collection = collection.filter((p: ProblemSchema) =>
      (p.tags || []).some((t) => t.toLowerCase() === tagLower),
    );
  }

  if (filters.queryStr) {
    const q = filters.queryStr.toLowerCase();
    collection = collection.filter(
      (p: ProblemSchema) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.notes || "").toLowerCase().includes(q),
    );
  }

  const totalItems = await collection.count();
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const results = await collection
    .offset((page - 1) * pageSize)
    .limit(pageSize)
    .toArray();

  return {
    problems: results as ProblemResponse[],
    meta: { page, totalPages, pageSize, totalItems },
  };
}

function extractFiltersAndPageSizeFromQueryKey(queryKey: QueryKey) {
  // Expected shape: ["problems", filtersForQuery, problemsPerPage]
  if (!Array.isArray(queryKey)) return [{}, 10];
  const filters =
    queryKey.length >= 2 && typeof queryKey[1] === "object"
      ? (queryKey[1] as AppQueryFilters)
      : {};
  const pageSize =
    queryKey.length >= 3 && typeof queryKey[2] === "number"
      ? (queryKey[2] as number)
      : 10;
  return [filters, pageSize] as const;
}

// Upsert a problem into all matching "problems" infiniteQuery caches.
export async function upsertProblemInInfinitePageCache(
  queryClient: QueryClient,
  problemId: number,
  defaultPageSize = 10,
) {
  const problem = await db.problems.where("id").equals(problemId).first();

  if (!problem) return;

  // gather matching queries (all queries where key starts with "problems")
  const matches = queryClient.getQueriesData({ queryKey: ["problems"] }); // returns Array<[QueryKey, any]>

  // If no cached queries exist, seed a canonical key
  if (!matches.length) {
    const canonicalKey = ["problems", {}, defaultPageSize] as QueryKey;
    const initialPage: PageShape = {
      problems: [problem as ProblemResponse],
      meta: {
        page: 1,
        pageSize: defaultPageSize,
        totalItems: 1,
        totalPages: 1,
      },
    };
    queryClient.setQueryData(canonicalKey, { pages: [initialPage] });
    return;
  }

  const tasks: Array<Promise<void>> = matches.map(async ([key, cachedData]) => {
    const queryKey = key as QueryKey;
    const queryCache = cachedData as InfiniteData<PageShape, unknown>;
    const hasPages =
      queryCache && queryCache.pages && Array.isArray(queryCache.pages);

    // Try to replace in-place if cache exists and contains the problem
    if (hasPages) {
      // Shallow copy pages to mutate safely
      const pages: PageShape[] = queryCache.pages.map((pg: PageShape) => ({
        ...pg,
        problems: [...pg.problems],
        meta: { ...pg.meta },
      }));

      let found = false;
      for (let pi = 0; pi < pages.length && !found; pi++) {
        const pg = pages[pi];
        for (let i = 0; i < pg.problems.length; i++) {
          const p = pg.problems[i];
          if (
            (problem.problem_id && p.problem_id === problem.problem_id) ||
            (problem.local_id && p.local_id === problem.local_id)
          ) {
            pages[pi].problems[i] = { ...p, ...problem };
            found = true;
            break;
          }
        }
      }

      if (found) {
        queryClient.setQueryData(queryKey, (old: typeof queryCache) => ({
          ...old,
          pages,
        }));
        return;
      }

      // not found in existing cached pages -> fallthrough to fetch local page 1 for this filter
    }

    // Extract filters & pageSize from the queryKey
    const [filters, pageSize] = extractFiltersAndPageSizeFromQueryKey(queryKey);

    // Read page 1 from local DB (async). This should include newly created local problems.
    const localPage = await getProblemsPageFromDB(
      filters as AppQueryFilters,
      1,
      pageSize as number,
    );

    // Now sync the cache: if there was cachedData with pages, replace the first page and leave rest intact
    if (hasPages) {
      const newPages = [
        localPage,
        // preserve existing cached pages after the first one (you might opt to drop them, but preserve is safer)
        ...queryCache.pages.slice(1),
      ];
      queryClient.setQueryData(queryKey, (old: typeof queryCache) => ({
        ...old,
        pages: newPages,
      }));
    } else {
      // no cached data previously: set a fresh pages array
      queryClient.setQueryData(queryKey, { pages: [localPage] });
    }
  });

  // await all tasks to finish
  await Promise.all(tasks);
}

export async function saveFetchedProblemsToLocalDB(
  problems: ProblemResponse[],
) {
  if (!problems?.length) return;

  const normalized = problems.map((problem) => ({
    ...problem,
    isOffline: 0,
  }));

  try {
    await db.transaction("rw", db.problems, db.meta, async () => {
      await db.problems.bulkPut(normalized);
      await setMeta("lastLocalDBUpdate", Date.now());
    });

    logger.debug("successfully upserted fetched problems into local DB");
  } catch (error) {
    logger.error(`error saving fetched problems to local DB: ${error}`);
  }

  const chunks = chunkArray(normalized);
  let successCount = 0;
  const failures: { problem: ProblemResponse; error: unknown }[] = [];

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map((p) => db.problems.put(p as ProblemResponse)),
    );

    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        successCount += 1;
      } else {
        failures.push({
          problem: chunk[i] as ProblemResponse,
          error: r.reason,
        });
      }
    });
  }

  if (successCount > 0) {
    try {
      await setMeta("lastLocalDBUpdate", Date.now());
      logger.debug(
        `upserted ${successCount} fetched problems into local DB (partial).`,
      );
    } catch (metaErr) {
      logger.error("failed to write lastLocalDBUpdate meta", metaErr);
    }
  }

  if (failures.length) {
    logger.error(
      `saveFetchedProblemsToLocalDB: ${failures.length} records failed to persist. TITLES: \n`,
      failures.map((f) => console.log(f.problem.name + "\n")),
    );
  }
}

export async function bulkAddProblems(
  problems: ProblemSchema[],
): Promise<number | undefined> {
  return await db.problems.bulkAdd(problems);
}

export async function addLocalProblem(
  problem: ProblemSchema,
): Promise<Partial<ProblemResponse> | undefined> {
  await db.problems.add(problem);
  await addOutboxEntry(
    ActionType.Create,
    ResourceType.Problem,
    problem as ProblemSchema,
  );

  const createdProblem = await db.problems
    .where("local_id")
    .equals(problem.local_id as string)
    .first();
  return createdProblem;
}

export async function getLocalProblem(id: string | number) {
  return await db.problems
    .where(isString(id) ? "local_id" : "problem_id")
    .equals(id)
    .first();
}

export async function updateLocalProblem(problem: ProblemSchema) {
  await db.problems.update(problem.id, problem);
  if (problem.problem_id) {
    await addOutboxEntry(
      ActionType.Update,
      ResourceType.Problem,
      problem as ProblemSchema,
    );
  } else {
    await updateOutboxPayload(
      problem.local_id as string,
      problem as Payload,
      ResourceType.Problem,
    );
  }
  return problem;
}

export async function deleteLocalProblem(id: string | number) {
  await db.problems
    .where(isString(id) ? "local_id" : "problem_id")
    .equals(id)
    .delete();
  // queue an outbox action if a problem_id was passed in here
  if (isNumber(id)) {
    return await addOutboxEntry(ActionType.Delete, ResourceType.Problem, {
      problem_id: id,
    } as ProblemSchema);
  }

  return await deleteOutboxEntry(id);
}

export async function clearOldProblems(): Promise<void> {
  return await db.problems.clear();
}

export async function getAllProblems(): Promise<ProblemSchema[]> {
  return await db.problems.orderBy("created_at").reverse().toArray();
}

export async function addLocalReminder(
  problemId: number | string,
  newReminder: ReminderSchema,
): Promise<Partial<ReminderResponse> | undefined> {
  const problemToUpdate = await db.problems
    .where(isString(problemId) ? "local_id" : "problem_id")
    .equals(problemId)
    .first();
  if (!problemToUpdate) return;

  let reminders = problemToUpdate.reminders ?? [];
  reminders = [newReminder as ReminderResponse, ...reminders];
  const updatedProblem = {
    ...problemToUpdate,
    reminders,
  };
  await db.problems.update(problemToUpdate.id, updatedProblem);

  // add outbox entry for reminder creation if problemId is number
  if (isNumber(problemId)) {
    newReminder.problem_id = problemId;
    await addOutboxEntry(
      ActionType.Create,
      ResourceType.Reminder,
      newReminder as ReminderSchema,
    );
    newReminder.problem_id = problemToUpdate.id; // Intentionally modified for use in cache update
    return newReminder;
  }

  await updateOutboxPayload(problemId, updatedProblem, ResourceType.Problem);
  newReminder.problem_id = problemToUpdate.id; // Intentionally modified for use in cache update
  return newReminder;
}

export async function updateLocalReminder(
  reminderId: number | string,
  problemId: number | string,
  payload: ReminderSchema,
) {
  async function performReminderUpdate(
    reminderId: number | string,
    problemId: number | string,
  ) {
    // query the problem table
    const problem = (await db.problems
      .where(isString(problemId) ? "local_id" : "problem_id")
      .equals(problemId)
      .first()) as ProblemSchema;

    // find reminder to update
    const reminders = problem.reminders as ReminderSchema[];
    const reminderToUpdate = reminders.find((reminder) =>
      isString(reminderId)
        ? reminder.local_id === reminderId
        : reminder.reminder_id === reminderId,
    ) as ReminderResponse;
    const reminderIndex = reminders.findIndex((reminder) =>
      isString(reminderId)
        ? reminder.local_id === reminderId
        : reminder.reminder_id === reminderId,
    );

    // update the reminder in the problem's reminders array
    const updatedReminder = { ...reminderToUpdate, ...payload };
    reminders.splice(reminderIndex, 1, updatedReminder);

    // update the problem in the DB
    const updatedProblem = { ...problem, reminders };
    await db.problems.update(problem.id, updatedProblem as ProblemSchema);

    return { updatedProblem, updatedReminder };
  }

  const { updatedProblem, updatedReminder } = await performReminderUpdate(
    reminderId,
    problemId,
  );

  // CASE 1: Updated unsynced reminder in unsynced problem
  if (isString(reminderId) && isString(problemId)) {
    // update problem's outbox entry
    await updateOutboxPayload(problemId, updatedProblem, ResourceType.Problem);
  }

  // CASE 2: Updated unsynced reminder in synced problem
  else if (isString(reminderId) && isNumber(problemId)) {
    // update reminder's outbox entry
    updatedReminder.problem_id = problemId;
    await updateOutboxPayload(
      reminderId,
      updatedReminder,
      ResourceType.Reminder,
    );
  }

  // CASE 3: Updated synced reminder in synced problem
  else if (isNumber(reminderId) && isNumber(problemId)) {
    // queue a reminder update action
    updatedReminder.problem_id = problemId;
    await addOutboxEntry(
      ActionType.Update,
      ResourceType.Reminder,
      updatedReminder as ReminderSchema,
    );
  }

  updatedReminder.problem_id = updatedProblem.id as number; // Intentionally modified for use in cache update
  return updatedReminder;
}

export async function deleteLocalReminder(
  reminderId: number | string,
  problemId: number | string,
) {
  async function performReminderDelete(
    reminderId: number | string,
    problemId: number | string,
  ) {
    const problem = (await db.problems
      .where(isString(problemId) ? "local_id" : "problem_id")
      .equals(problemId)
      .first()) as ProblemSchema;
    const reminders = problem.reminders as ReminderSchema[];
    const reminderIndex = reminders.findIndex((reminder) =>
      isString(reminderId)
        ? reminder.local_id === reminderId
        : reminder.reminder_id === reminderId,
    );
    reminders.splice(reminderIndex, 1);
    const updatedProblem = { ...problem, reminders };
    await db.problems.update(problem.id, updatedProblem as ProblemSchema);
    return updatedProblem;
  }

  const updatedProblem = await performReminderDelete(reminderId, problemId);

  // CASE 1: Deleted synced reminder in synced problem
  if (isNumber(problemId) && isNumber(reminderId)) {
    // add outbox entry for reminder deletion
    return await addOutboxEntry(ActionType.Delete, ResourceType.Reminder, {
      reminder_id: reminderId,
      problem_id: problemId,
    } as ReminderSchema);
  }

  // CASE 2: Deleted unsynced reminder in synced problem
  else if (isNumber(problemId) && isString(reminderId)) {
    // delete existing outbox entry for reminder creation
    return await deleteOutboxEntry(reminderId);
  }

  // CASE 3:  Deleted unsynced reminder in unsynced problem
  else if (isString(problemId) && isString(reminderId)) {
    // update outbox entry for problem creation
    return await updateOutboxPayload(
      problemId,
      updatedProblem,
      ResourceType.Problem,
    );
  }
}

function getResourceId(resource: ResourceType, payload: Payload) {
  if (resource === ResourceType.Problem) {
    return (
      ((payload as ProblemSchema).local_id as string) ||
      ((payload as ProblemSchema).problem_id as number)
    );
  } else if (resource === ResourceType.Reminder) {
    return (
      ((payload as ReminderSchema).local_id as string) ||
      ((payload as ReminderSchema).reminder_id as number)
    );
  }
}

export async function addOutboxEntry(
  type: ActionType,
  resource: ResourceType,
  payload: Payload,
) {
  const entry = {
    type,
    resource,
    resourceId: getResourceId(resource, payload)!,
    payload: { ...payload },
    status: StatusType.Pending,
    createdAt: Date.now(),
    retryCount: 0,
  };

  return await db.outbox.add(entry);
}

export async function getOutboxEntry(
  resourceId: string | number,
  resource: ResourceType,
) {
  return await db.outbox
    .where("resourceId")
    .equals(resourceId)
    .and((entry) => entry.resource === resource)
    .first();
}

export async function updateOutboxPayload(
  resourceId: string,
  payload: Payload,
  resource: ResourceType,
) {
  const record = await getOutboxEntry(resourceId, resource);
  return await db.outbox.update(record?.id as number, { ...record, payload });
}

export async function deleteOutboxEntry(resourceId: string | number) {
  return await db.outbox.where("resourceId").equals(resourceId).delete();
}

export async function setMeta<T>(key: string, value: T) {
  return await db.meta.put({ key, value });
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const record = await db.meta.get(key);
  return record?.value as T | undefined;
}

export async function addLocalNotification(notificationPayload: Notification) {
  try {
    const {
      body: {
        meta: { problem_id, due_datetime },
      },
    } = notificationPayload;
    return await db.notifications.put({
      ...notificationPayload,
      problem_id,
      due_datetime,
    });
  } catch (error) {
    logger.error(
      `error adding local notification to indexedDB, error: ${error}`,
    );
  }
}

export async function fetchLocalNotifications() {
  try {
    return await db.notifications.orderBy("due_datetime").reverse().toArray();
  } catch (error) {
    logger.error(`failed to fetch local notifications, error: ${error}`);
  }
}

export async function deleteLocalNotification(problemId: number) {
  try {
    return await db.notifications
      .where("problem_id")
      .equals(problemId)
      .delete();
  } catch (error) {
    logger.error(`failed to delete local notification, error: ${error}`);
  }
}

export async function clearLocalNotifications() {
  try {
    return await db.notifications.clear();
  } catch (error) {
    logger.error(`failed to clear local notifications, error: ${error}`);
  }
}
