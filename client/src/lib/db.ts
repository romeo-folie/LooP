import Dexie, { EntityTable} from 'dexie';
import { ReminderResponse } from '@/pages/problems/ProblemDashboard';

// TODO: Define a schema for the outbox that'll serve as a queue for local mutations that need to be synced when online
// could get this to use the ProblemResponse type definition
interface ProblemSchema {
  id?: number;
  problem_id?: number;
  user_id: number;
  name: string;
  difficulty: string;
  tags: string[];
  date_solved: Date;
  notes: string;
  reminders: ReminderResponse[];
}

export const db = new Dexie("loopDB") as Dexie & {
  problems: EntityTable<ProblemSchema, 'id'>
};

db.version(1).stores({
  problems: "++id, &problem_id, user_id, name, difficulty, *tags, date_solved, notes, reminders",
})

//TODO: clear db before bulk adding problems?
export async function bulkAddProblems(problems: ProblemSchema[]): Promise<void> {
  return await db.transaction('rw', db.problems, async () => {
    await db.problems.bulkAdd(problems);
  })
}

export async function getAllProblems(): Promise<ProblemSchema[]> {
  return await db.problems.toArray()
}