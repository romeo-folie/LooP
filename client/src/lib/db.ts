import Dexie, { EntityTable } from "dexie";
import {
  ProblemResponse,
} from "@/pages/problems/ProblemDashboard";

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

interface OutboxSchema {
  id: number;
  type: ActionType;
  resource: ResourceType;
  payload: object;
  status: StatusType;
  createdAt: number;
  retryCount: number;
  lastAttemptAt?: number;
}

// TODO: get this to use the ProblemResponse type definition
// interface ProblemSchema {
//   id?: number;
//   problem_id?: number;
//   user_id: number;
//   name: string;
//   difficulty: string;
//   tags: string[];
//   date_solved: Date;
//   notes: string;
//   reminders?: ReminderResponse[];
//   isOffline?: number; // boolean
// }
export type ProblemSchema = Partial<ProblemResponse> & {
  id?: number;
  isOffline?: number;
};

export const db = new Dexie("loopDB") as Dexie & {
  problems: EntityTable<ProblemSchema, "id">;
  outbox: EntityTable<OutboxSchema, "id">;
};

db.version(1).stores({
  problems:
    "++id, &problem_id, user_id, name, difficulty, *tags, date_solved, notes, reminders, isOffline",
  outbox:
    "++id, type, resource, payload, status, createdAt, lastAttemptAt",
});

export async function bulkAddProblems(
  problems: ProblemSchema[]
): Promise<void> {
  return await db.transaction("rw", db.problems, async () => {
    await db.problems.bulkAdd(problems);
  });
}

export async function addProblem(problem: ProblemSchema): Promise<number> {
  await db.problems.add(problem);
  return await addOutboxEntry(ActionType.Create, ResourceType.Problem, problem);
}

export async function clearOldProblems(): Promise<number> {
  return await db.problems.where("isOffline").equals(0).delete();
}

export async function getAllProblems(): Promise<ProblemSchema[]> {
  return await db.problems.toArray();
}

export async function getProblem(
  id: number
): Promise<ProblemSchema | undefined> {
  return await db.problems.get(id);
}

export async function updateProblemLocally(id: number, problem: ProblemSchema) {
  await db.problems.update(id, problem);
  return await addOutboxEntry(ActionType.Update, ResourceType.Problem, problem);
}

export async function addOutboxEntry(type: ActionType, resource: ResourceType, payload: object) {
  const entry = {
    type,
    resource,
    payload: { ...payload },
    status: StatusType.Pending,
    createdAt: Date.now(),
    retryCount: 0,
  };

  return await db.outbox.add(entry);
}