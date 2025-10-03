import request from "supertest";
import path from "path";
import { jest } from "@jest/globals";
import { loginAndGetCsrf, reqWithCsrf } from "./utils/csrf";
import { db as testDb } from "../src/db";
import type { ProblemsRepo } from "../src/repositories/problem.repo";
import app from "../src/app";
import { IProblemRow } from "../src/types/knex-tables";
import {
  createTestProblem,
  createTestUser,
  TEST_USER,
  VALID_PASSWORD,
} from "./utils/create-test-entities";

const PROBLEMS_REPO_PATH = path.resolve(
  __dirname,
  "../../src/repositories/problem.repo",
);

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
    await testDb.raw("ALTER SEQUENCE users_user_id_seq RESTART WITH 1");
  } catch (e) {}
});

describe("problem integration tests", () => {
  describe("POST /api/problems", () => {
    test("Create problem (happy path) — creates problem and 3 default reminders when autoReminders true", async () => {
      if (!testDb) throw new Error("testDb not initialized");

      const user = (await createTestUser()) as TEST_USER;

      const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
        app,
        user.email,
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

      const res = await reqWithCsrf(
        app,
        "post",
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

    test("Validation: missing required fields -> 400 and no DB insert", async () => {
      if (!testDb) throw new Error("testDb not initialized");

      const user = (await createTestUser()) as TEST_USER;
      const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
        app,
        user.email,
        VALID_PASSWORD,
      );
      const csrfTokenValue = cookies["CSRF-TOKEN"];

      const body = {
        difficulty: "Medium",
        tags: ["dp"],
        // missing name and date_solved
      };

      const res = await reqWithCsrf(
        app,
        "post",
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

    test("Unauthorized: missing CSRF token -> 403", async () => {
      const body = {
        name: "Sample",
        difficulty: "Easy",
        tags: ["a"],
        date_solved: "2025-09-01",
      };

      const res = await request(app)
        .post("/api/problems")
        .send(body)
        .expect(403);
      expect(res.body).toHaveProperty("error");
    });

    test("Tags normalization -> tags saved lowercased & trimmed", async () => {
      if (!testDb) throw new Error("testDb not initialized");

      const user = (await createTestUser()) as TEST_USER;
      const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
        app,
        user.email,
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

      const res = await reqWithCsrf(
        app,
        "post",
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

    test("Simulated DB failure -> returns 500", async () => {
      if (!testDb) throw new Error("testDb not initialized");

      const user = (await createTestUser()) as TEST_USER;

      const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
        app,
        user.email,
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

        const res = await reqWithCsrf(
          app,
          "post",
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

  describe("GET /api/problems", () => {
    test("returns the problem (happy path)", async () => {
      if (!testDb) throw new Error("testDb not initialized");

      const user = (await createTestUser()) as TEST_USER;
      const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
        app,
        user.email,
        VALID_PASSWORD,
      );
      const csrf = cookies["CSRF-TOKEN"] as string;

      const created = await createTestProblem({
        user,
        accessToken,
        cookieHeader,
        csrfTokenValue: csrf,
        opts: {
          name: "ReadMe",
          tags: ["arrays", "graphs"],
          autoReminders: false,
        },
      });

      const id = created.problem_id;

      const getRes = await request(app)
        .get(`/api/problems/${id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(getRes.body).toHaveProperty("problem");
      const p = getRes.body.problem;
      expect(p.problem_id).toBe(id);
      expect(p.name).toBe("ReadMe");

      // verify DB row matches
      const dbRow = await testDb("problems").where({ problem_id: id }).first();
      expect(dbRow).toBeDefined();
      expect(dbRow!.name).toBe("ReadMe");
    });

    test("404 for non-existent id", async () => {
      if (!testDb) throw new Error("testDb not initialized");

      const user = (await createTestUser()) as TEST_USER;
      const { accessToken } = await loginAndGetCsrf(
        app,
        user.email,
        VALID_PASSWORD,
      );

      const missingId = 9999;
      await request(app)
        .get(`/api/problems/${missingId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe("PUT /api/problems/:id", () => {
    test("update (normalize tags)", async () => {
      if (!testDb) throw new Error("testDb not initialized");

      const user = (await createTestUser()) as TEST_USER;
      const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
        app,
        user.email,
        VALID_PASSWORD,
      );
      const csrf = cookies["CSRF-TOKEN"] as string;

      const created = await createTestProblem({
        user,
        accessToken,
        cookieHeader,
        csrfTokenValue: csrf,
        opts: { name: "updateMe", tags: ["dp"], autoReminders: false },
      });

      const id = created.problem_id;

      const putBody = {
        name: "Updated Name",
        difficulty: "Medium",
        tags: [" Graph ", " DP "],
        date_solved: "2025-09-01",
      };

      const putRes = await reqWithCsrf(
        app,
        "put",
        `/api/problems/${id}`,
        accessToken,
        cookieHeader,
        csrf,
        putBody,
      );

      expect(putRes.status).toBe(200);
      expect(putRes.body).toHaveProperty("problem");
      expect(putRes.body.problem.name).toBe("Updated Name");

      // confirm DB normalized tags stored as JSON-string lowercased/trimmed
      const dbRow = await testDb("problems").where({ problem_id: id }).first();
      console.log("DB ROW ", dbRow);
      const storedTags = JSON.parse(dbRow!.tags as string) as string[];
      expect(storedTags).toEqual(["graph", "dp"]);
    });

    test("invalid payload returns 400 and DB unchanged", async () => {
      if (!testDb) throw new Error("testDb not initialized");

      const user = (await createTestUser()) as TEST_USER;
      const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
        app,
        user.email,
        VALID_PASSWORD,
      );
      const csrf = cookies["CSRF-TOKEN"] as string;

      const created = await createTestProblem({
        user,
        accessToken,
        cookieHeader,
        csrfTokenValue: csrf,
        opts: { name: "BadPut", tags: ["a"], autoReminders: false },
      });

      const id = created.problem_id;

      // invalid difficulty (assuming valid enum is ['Easy','Medium','Hard'])
      const body = { difficulty: "ULTRA" };

      const res = await reqWithCsrf(
        app,
        "put",
        `/api/problems/${id}`,
        accessToken,
        cookieHeader,
        csrf,
        body,
      );
      expect(res.status).toBe(400);

      // DB should be unchanged
      const dbRow = await testDb("problems").where({ problem_id: id }).first();
      expect(dbRow!.difficulty).toBe("Easy");
    });
  });

  test("DELETE /api/problems/:id — deletes problem and cascade-deletes reminders", async () => {
    if (!testDb) throw new Error("testDb not initialized");

    const user = (await createTestUser()) as TEST_USER;
    const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
      app,
      user.email,
      VALID_PASSWORD,
    );
    const csrf = cookies["CSRF-TOKEN"] as string;

    // create with autoReminders true so reminders exist
    const created = await createTestProblem({
      user,
      accessToken,
      cookieHeader,
      csrfTokenValue: csrf,
      opts: {
        name: "ToDelete",
        tags: ["a"],
        date_solved: "2025-09-01",
        autoReminders: true,
      },
    });

    const id = created.problem_id;

    // confirm reminders exist
    const beforeReminders = await testDb("reminders").where({ problem_id: id });
    expect(beforeReminders.length).toBeGreaterThan(0);

    const res = await reqWithCsrf(
      app,
      "delete",
      `/api/problems/${id}`,
      accessToken,
      cookieHeader,
      csrf,
    );
    expect(res.status).toBe(200);

    const p = await testDb("problems").where({ problem_id: id }).first();
    expect(p).toBeUndefined();

    const reminders = await testDb("reminders").where({ problem_id: id });
    expect(reminders.length).toBe(0);
  });

  test("Authorization: user B cannot read/put/delete user A's problem", async () => {
    if (!testDb) throw new Error("testDb not initialized");

    const userA = (await createTestUser()) as TEST_USER;
    const {
      accessToken: tokenA,
      cookies: cookiesA,
      cookieHeader: cookieHeaderA,
    } = await loginAndGetCsrf(app, userA.email, VALID_PASSWORD);
    const csrfA = cookiesA["CSRF-TOKEN"];

    // create problem as A
    const created = await createTestProblem({
      user: userA,
      accessToken: tokenA,
      cookieHeader: cookieHeaderA,
      csrfTokenValue: csrfA!,
      opts: {
        name: "Private",
        difficulty: "Medium",
        tags: ["a"],
        date_solved: "2025-09-01",
        autoReminders: false,
      },
    });
    const id = created.problem_id;

    // create user B
    const userB = (await createTestUser(
      "Test User2",
      "testuser2@example.com",
      VALID_PASSWORD,
    )) as TEST_USER;
    const {
      accessToken: tokenB,
      cookies: cookiesB,
      cookieHeader: cookieHeaderB,
    } = await loginAndGetCsrf(app, userB.email, VALID_PASSWORD);
    const csrfB = cookiesB["CSRF-TOKEN"];

    // user B tries to GET
    await request(app)
      .get(`/api/problems/${id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);

    // user B tries to PUT
    const body = {
      name: "Hacked",
      difficulty: "Hard",
      tags: ["b"],
      date_solved: "2025-09-01",
    };
    const putRes = await reqWithCsrf(
      app,
      "put",
      `/api/problems/${id}`,
      tokenB,
      cookieHeaderB,
      csrfB,
      body,
    );
    expect(putRes.status).toBe(404);

    // user B tries to DELETE
    const delRes = await reqWithCsrf(
      app,
      "delete",
      `/api/problems/${id}`,
      tokenB,
      cookieHeaderB,
      csrfB,
      body,
    );
    expect(delRes.status).toBe(404);

    // ensure problem still exists for owner A
    const dbRow = await testDb("problems").where({ problem_id: id }).first();
    expect(dbRow).toBeDefined();
    expect(dbRow!.name).toBe("Private");
  });
});
