import Dexie, { EntityTable } from "dexie";
import {
  ProblemResponse,
  ReminderResponse,
} from "@/pages/problems/ProblemDashboard";
import { isInteger, isString } from "lodash";

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
    problem as Payload
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
      problem
    );
  return await updateOutboxPayload(
    problem.local_id as string,
    problem as Payload
  );
}

export async function deleteLocalProblem(id: string | number) {
  await db.problems
    .where(isString(id) ? "local_id" : "problem_id")
    .equals(id)
    .delete();
  // queue an outbox action if a problem_id was passed in here
  if (isInteger(id)) {
    return await addOutboxEntry(ActionType.Delete, ResourceType.Problem, {
      problem_id: id,
    } as Payload);
  }

  return await deleteOutboxEntry(id);
}

export async function clearOldProblems(): Promise<void> {
  return await db.problems.clear();
}

export async function getAllProblems(): Promise<ProblemSchema[]> {
  return await db.problems.toArray();
}

export async function addOutboxEntry(
  type: ActionType,
  resource: ResourceType,
  payload: Payload
) {
  const entry = {
    type,
    resource,
    resourceId: (payload.local_id as string) || (payload.problem_id as number),
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
  payload: Payload
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
