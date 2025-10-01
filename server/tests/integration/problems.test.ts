process.env.NODE_ENV = "test";

import request from "supertest";
import path from "path";
import { jest } from "@jest/globals";
import { Application } from "express";
import { loginAndGetCsrf, postWithCsrf } from "../utils/csrf";
import { db as testDb } from "../../src/db";
import bcrypt from "bcrypt";
import type { ProblemsRepo } from "../../src/repositories/problem.repo";
import app from "../../src/app";
import { IProblemRow } from "../../src/types/knex-tables";

const PROBLEMS_REPO_PATH = path.resolve(
  __dirname,
  "../../src/repositories/problem.repo",
);

describe("POST /api/problems (integration - sqlite test migrations)", () => {
  beforeAll(async () => {
    try {
      console.log("Applying test migrations...");
      await testDb.migrate.latest();
      console.log("Test migrations applied successfully.");
    } catch (error) {
      console.error("Error applying test migrations:", error);
      throw error;
    }
  });

  afterAll(async () => {
    console.log("Destroying Test DB");
    await testDb.destroy();
  });

  afterEach(async () => {
    await testDb("reminders").del();
    await testDb("problems").del();
    await testDb("user_preferences").del();
    await testDb("users").del();

    try {
      await testDb.raw("ALTER SEQUENCE problems_problem_id_seq RESTART WITH 1");
      await testDb.raw("ALTER SEQUENCE users_user_id_seq RESTART WITH 1");
    } catch (e) {}
  });

  const VALID_EMAIL = "testuser@example.com";
  const VALID_PASSWORD = "testPassw0rD%";

  async function createTestUser() {
    if (!testDb) throw new Error("testDb not initialized");

    const HASHED_PASSWORD = await bcrypt.hash(VALID_PASSWORD, 10);

    const [user] = await testDb("users").insert(
      {
        name: "Test User",
        email: VALID_EMAIL,
        password: HASHED_PASSWORD,
        provider: "local",
        created_at: new Date(),
        updated_at: new Date(),
      },
      ["user_id", "email", "name"],
    );

    return user;
  }

  test("1) Create problem (happy path) — creates problem and 3 default reminders when autoReminders true", async () => {
    if (!testDb) throw new Error("testDb not initialized");

    const user = await createTestUser();

    const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
      app,
      user!.email,
      VALID_PASSWORD,
    );
    const csrfTokenValue = cookies["CSRF-TOKEN"];

    // insert user_preferences; note we store settings as JSON string
    await testDb("user_preferences").insert({
      user_id: user?.user_id,
      settings: JSON.stringify({ autoReminders: true }),
      created_at: new Date(),
      updated_at: new Date(),
    });

    const body = {
      name: "Two Sum",
      difficulty: "Easy",
      tags: ["Array", "HashMap"],
      date_solved: "2025-09-01", // date-only
      notes: "Classic problem",
    };

    const res = await postWithCsrf(
      app as Application,
      "/api/problems",
      accessToken,
      cookieHeader,
      csrfTokenValue as string,
      body,
    );

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("message");
    expect(res.body).toHaveProperty("problem");
    const createdProblem = res.body.problem as Partial<IProblemRow>;
    expect(createdProblem).toHaveProperty("problem_id");
    expect(createdProblem.name).toBe("Two Sum");

    // Verify problem exists in DB
    const dbProblem = await testDb("problems")
      .where({ problem_id: createdProblem.problem_id })
      .first();
    expect(dbProblem).toBeDefined();
    expect(dbProblem!.name).toBe("Two Sum");

    // Verify 3 reminders were created
    const reminders = await testDb("reminders")
      .where({ problem_id: createdProblem.problem_id })
      .orderBy("due_datetime", "asc");
    expect(reminders.length).toBe(3);

    const solvedDate = new Date(body.date_solved + "T00:00:00Z");
    const dueDays = [3, 7, 15];
    reminders.forEach((r, idx) => {
      const due = new Date(r.due_datetime);
      const expected = new Date(solvedDate);
      expected.setUTCDate(expected.getUTCDate() + dueDays[idx]!);
      expected.setUTCHours(9, 0, 0, 0);
      expect(due.getUTCFullYear()).toBe(expected.getUTCFullYear());
      expect(due.getUTCMonth()).toBe(expected.getUTCMonth());
      expect(due.getUTCDate()).toBe(expected.getUTCDate());
      expect(due.getUTCHours()).toBe(9);
    });
  });

  test("2) Validation: missing required fields -> 400 and no DB insert", async () => {
    if (!testDb) throw new Error("testDb not initialized");

    const user = await createTestUser();
    const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
      app,
      user!.email,
      VALID_PASSWORD,
    );
    const csrfTokenValue = cookies["CSRF-TOKEN"];

    const body = {
      difficulty: "Medium",
      tags: ["dp"],
      // missing name and date_solved
    };

    const res = await postWithCsrf(
      app,
      "/api/problems",
      accessToken,
      cookieHeader,
      csrfTokenValue as string,
      body,
    );

    expect(res.status).toBe(400);
    expect(res.body).toBeDefined();
    const rows = await testDb("problems").select("*");
    expect(rows.length).toBe(0);
  });

  test("3) Unauthorized: missing CSRF token -> 403", async () => {
    const body = {
      name: "Sample",
      difficulty: "Easy",
      tags: ["a"],
      date_solved: "2025-09-01",
    };

    const res = await request(app).post("/api/problems").send(body).expect(403);
    expect(res.body).toHaveProperty("error");
  });

  test("4) Tags normalization -> tags saved lowercased & trimmed", async () => {
    if (!testDb) throw new Error("testDb not initialized");

    const user = await createTestUser();
    const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
      app,
      user!.email,
      VALID_PASSWORD,
    );
    const csrfTokenValue = cookies["CSRF-TOKEN"];

    await testDb("user_preferences").insert({
      user_id: user!.user_id,
      settings: JSON.stringify({ autoReminders: false }),
      created_at: new Date(),
      updated_at: new Date(),
    });

    const body = {
      name: "Two Sum",
      difficulty: "Easy",
      tags: [" Array ", " HASHMAP "],
      date_solved: "2025-09-01",
      notes: "Classic",
    };

    const res = await postWithCsrf(
      app,
      "/api/problems",
      accessToken,
      cookieHeader,
      csrfTokenValue as string,
      body,
    );

    expect(res.status).toBe(201);
    const createdProblem = res.body.problem as Partial<IProblemRow>;
    const dbProblem = await testDb("problems")
      .where({ problem_id: createdProblem.problem_id })
      .first();

    // tags stored as JSON string in the test migrations
    const storedTagsRaw = dbProblem!.tags;
    expect(typeof storedTagsRaw).toBe("string");
    const parsed = JSON.parse(storedTagsRaw as string) as string[];
    expect(parsed).toEqual(["array", "hashmap"]);
  });

  test("5) Simulated DB failure -> returns 500", async () => {
    if (!testDb) throw new Error("testDb not initialized");

    const user = await createTestUser();

    const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
      app,
      user!.email,
      VALID_PASSWORD,
    );
    const csrfTokenValue = cookies["CSRF-TOKEN"];

    let insertSpy;
    try {
      const { problemsRepo } = (await import(PROBLEMS_REPO_PATH)) as {
        problemsRepo: ProblemsRepo;
      };

      if (!problemsRepo || typeof problemsRepo.insertProblem !== "function") {
        throw new Error(
          "problemsRepo.insertProblem not found - check PROBLEMS_REPO_PATH",
        );
      }

      insertSpy = jest
        .spyOn(problemsRepo, "insertProblem")
        .mockImplementation(() => {
          throw new Error("Simulated DB failure");
        });

      const body = {
        name: "EdgeCase",
        difficulty: "Hard",
        tags: ["graphs"],
        date_solved: "2025-09-01",
        notes: "",
      };

      const res = await postWithCsrf(
        app,
        "/api/problems",
        accessToken,
        cookieHeader,
        csrfTokenValue as string,
        body,
      );

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty("error");
    } finally {
      if (insertSpy && insertSpy.mockRestore) {
        insertSpy.mockRestore();
      }
    }
  });
});
