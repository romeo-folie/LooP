import Dexie, { EntityTable } from "dexie";
import {
  ProblemResponse,
  ReminderResponse,
} from "@/pages/problems/ProblemDashboard";
import { isNumber, isString } from "lodash";

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

interface SchemaDefaults {
  id?: number;
  isOffline?: number;
}

export type ProblemSchema = Partial<ProblemResponse> & SchemaDefaults;

export type ReminderSchema = Partial<ReminderResponse> & SchemaDefaults;

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
};

db.version(1).stores({
  problems:
    "++id, &problem_id, user_id, local_id, name, difficulty, *tags, date_solved, notes, reminders, isOffline",
  outbox:
    "++id, type, resource, resourceId, payload, status, createdAt, lastAttemptAt",
  meta: "key",
});

export async function bulkAddProblems(problems: ProblemSchema[]) {
  return await db.problems.bulkAdd(problems);
}

export async function addLocalProblem(problem: ProblemSchema): Promise<number> {
  await db.problems.add(problem);
  return await addOutboxEntry(
    ActionType.Create,
    ResourceType.Problem,
    problem as ProblemSchema,
  );
}

export async function getLocalProblem(id: string | number) {
  return await db.problems
    .where(isString(id) ? "local_id" : "problem_id")
    .equals(id)
    .first();
}

export async function updateLocalProblem(problem: ProblemSchema) {
  await db.problems.update(problem.id, problem);
  if (problem.problem_id)
    return await addOutboxEntry(
      ActionType.Update,
      ResourceType.Problem,
      problem as ProblemSchema,
    );
  return await updateOutboxPayload(
    problem.local_id as string,
    problem as Payload,
  );
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
  return await db.problems.toArray();
}

export async function addLocalReminder(
  problemId: number | string,
  newReminder: ReminderSchema,
) {
  const problemToUpdate = await db.problems
    .where(isString(problemId) ? "local_id" : "problem_id")
    .equals(problemId)
    .first();
  if (!problemToUpdate) return;

  const reminders = problemToUpdate.reminders ?? [];
  reminders.push(newReminder as ReminderResponse);
  const updatedProblem = {
    ...problemToUpdate,
    reminders,
  };
  await db.problems.update(problemToUpdate.id, updatedProblem);

  // add outbox entry for reminder creation if problemId is number
  if (isNumber(problemId)) {
    newReminder.problem_id = problemId;
    return await addOutboxEntry(
      ActionType.Create,
      ResourceType.Reminder,
      newReminder as ReminderSchema,
    );
  }

  return await updateOutboxPayload(problemId, updatedProblem);
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

    return { updatedReminder, updatedProblem };
  }

  const { updatedProblem, updatedReminder } = await performReminderUpdate(
    reminderId,
    problemId,
  );

  // CASE 1: Updated unsynced reminder in unsynced problem
  if (isString(reminderId) && isString(problemId)) {
    // update problem's outbox entry
    return await updateOutboxPayload(problemId, updatedProblem);
  }

  // CASE 2: Updated unsynced reminder in synced problem
  else if (isString(reminderId) && isNumber(problemId)) {
    // update reminder's outbox entry
    updatedReminder.problem_id = problemId;
    return await updateOutboxPayload(reminderId, updatedReminder);
  }

  // CASE 3: Updated synced reminder in synced problem
  else if (isNumber(reminderId) && isNumber(problemId)) {
    // queue a reminder update action
    updatedReminder.problem_id = problemId;
    return await addOutboxEntry(
      ActionType.Update,
      ResourceType.Reminder,
      updatedReminder as ReminderSchema,
    );
  }
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
    return await updateOutboxPayload(problemId, updatedProblem);
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

export async function getOutboxEntry(resourceId: string | number) {
  return await db.outbox.where("resourceId").equals(resourceId).first();
}

export async function updateOutboxPayload(
  resourceId: string,
  payload: Payload,
) {
  const record = await getOutboxEntry(resourceId);
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
