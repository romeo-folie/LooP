import { db as testDb } from "../../src/db";
import bcrypt from "bcrypt";
import { IProblemRow, IUserRow } from "../../src/types/knex-tables";
import { postWithCsrf } from "./csrf";
import app from "../../src/app";

export const VALID_EMAIL = "testuser@example.com";
export const VALID_PASSWORD = "testPassw0rD%";
export type TEST_USER = Pick<IUserRow, "user_id" | "name" | "email">;

export async function createTestUser(
  name?: string,
  email?: string,
  password?: string,
): Promise<TEST_USER | undefined> {
  if (!testDb) throw new Error("testDb not initialized");

  const HASHED_PASSWORD = await bcrypt.hash(password ?? VALID_PASSWORD, 10);

  const [user] = await testDb("users").insert(
    {
      name: name ?? "Test User",
      email: email ?? VALID_EMAIL,
      password: HASHED_PASSWORD,
      provider: "local",
      created_at: new Date(),
      updated_at: new Date(),
    },
    ["user_id", "email", "name"],
  );

  return user;
}

export async function createTestProblem({
  user,
  accessToken,
  cookieHeader,
  csrfTokenValue,
  opts = {},
}: {
  user: { user_id: number; email: string; name: string };
  accessToken: string;
  cookieHeader: string | undefined;
  csrfTokenValue: string;
  opts?: Partial<{
    name: string;
    difficulty: string;
    tags: string[];
    date_solved: string;
    notes: string;
    autoReminders?: boolean;
  }>;
}): Promise<Partial<IProblemRow>> {
  const autoReminders = opts.autoReminders ?? false;
  await testDb("user_preferences").insert({
    user_id: user.user_id,
    settings: JSON.stringify({ autoReminders }),
    created_at: new Date(),
    updated_at: new Date(),
  });

  const body = {
    name: opts.name ?? "Seed Problem",
    difficulty: opts.difficulty ?? "Easy",
    tags: opts.tags ?? ["dp"],
    date_solved: opts.date_solved ?? "2025-09-01",
    notes: opts.notes ?? "seed",
  };

  const createRes = await postWithCsrf(
    app,
    "/api/problems",
    accessToken,
    cookieHeader as string,
    csrfTokenValue,
    body,
  );

  expect(createRes.status).toBe(201);
  return createRes.body.problem as Partial<IProblemRow>;
}
