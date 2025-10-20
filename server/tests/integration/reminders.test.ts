import app from "../../src/app";
import { db as testDb } from "../../src/db";
import { shutdownRedis } from "../../src/middleware/rate-limiter";
import { IReminderRow } from "../../src/types/knex-tables";
import {
  createTestUser,
  VALID_PASSWORD,
  createTestProblem,
  TEST_USER,
} from "../utils/create-test-entities";
import { loginAndGetCsrf, reqWithCsrf } from "../utils/csrf";
import request from "supertest";

beforeAll(async () => {
  try {
    await testDb.migrate.latest();
  } catch (error) {
    console.error("Error applying test migrations:", error);
    throw error;
  }
});

afterAll(async () => {
  console.log("Destroying Test DB");
  await testDb.destroy();
  shutdownRedis();
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

describe("Reminder integration tests", () => {
  describe("POST /api/reminders", () => {
    test("create reminder and return 201 with reminder row(happy path)", async () => {
      const user = (await createTestUser()) as TEST_USER;
      const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
        app,
        user.email,
        VALID_PASSWORD,
      );
      const csrf = cookies["CSRF-TOKEN"] as string;

      const createdProblem = await createTestProblem({
        user,
        accessToken,
        cookieHeader,
        csrfTokenValue: csrf,
        opts: { name: "RSeed", autoReminders: false, tags: ["a"] },
      });

      const problemId = createdProblem.problem_id as number;

      const dueIso = "2025-10-01T09:00:00Z";

      const body = {
        due_datetime: dueIso,
      };

      const res = await reqWithCsrf(
        app,
        "post",
        `/api/reminders/${problemId}`,
        accessToken,
        cookieHeader,
        csrf,
        body,
      );

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("reminder");
      const created = res.body.reminder as IReminderRow;

      // verify DB row
      const dbRow = await testDb("reminders")
        .where({ reminder_id: created.reminder_id })
        .first();
      expect(dbRow).toBeDefined();
      expect(dbRow!.problem_id).toBe(problemId);
      // stored due_datetime should be ISO string and equal when parsed
      expect(new Date(dbRow!.due_datetime).toISOString()).toBe(
        new Date(dueIso).toISOString(),
      );
    });

    test("unauthorized: missing access token -> 401", async () => {
      const user = (await createTestUser()) as TEST_USER;
      const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
        app,
        user.email,
        VALID_PASSWORD,
      );
      const csrf = cookies["CSRF-TOKEN"] as string;

      // create a problem to target
      const createdProblem = await createTestProblem({
        user,
        accessToken,
        cookieHeader,
        csrfTokenValue: csrf,
        opts: { autoReminders: false },
      });

      const problemId = createdProblem.problem_id as number;

      const res = await reqWithCsrf(
        app,
        "post",
        `/api/reminders/${problemId}`,
        null /* accessToken */,
        cookieHeader,
        csrf,
        {
          due_datetime: "2025-10-01T09:00:00Z",
        },
      );

      expect(res.status).toBe(401);
    });

    test("validation: invalid due_datetime -> 400 and no DB insert", async () => {
      const user = (await createTestUser()) as TEST_USER;
      const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
        app,
        user.email,
        VALID_PASSWORD,
      );
      const csrf = cookies["CSRF-TOKEN"] as string;

      const createdProblem = await createTestProblem({
        user,
        accessToken,
        cookieHeader,
        csrfTokenValue: csrf,
        opts: { autoReminders: false },
      });

      const problemId = createdProblem.problem_id as number;

      const res = await reqWithCsrf(
        app,
        "post",
        `/api/reminders/${problemId}`,
        accessToken,
        cookieHeader,
        csrf,
        {
          due_datetime: "not-a-date",
        },
      );

      expect(res.status).toBe(400);
      // ensure nothing inserted
      const rows = await testDb("reminders").select("*");
      expect(rows.length).toBe(0);
    });

    test("not found: problem does not exist -> 404 and no DB insert", async () => {
      const user = (await createTestUser()) as TEST_USER;
      const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
        app,
        user.email,
        VALID_PASSWORD,
      );
      const csrf = cookies["CSRF-TOKEN"] as string;

      // use a non-existent problem id
      const missingProblemId = 99999;

      const res = await reqWithCsrf(
        app,
        "post",
        `/api/reminders/${missingProblemId}`,
        accessToken,
        cookieHeader,
        csrf,
        {
          due_datetime: "2025-10-01T09:00:00Z",
        },
      );

      expect(res.status).toBe(404);
      const rows = await testDb("reminders").select("*");
      expect(rows.length).toBe(0);
    });

    test("stores due_datetime as ISO string when given Date input (stringified)", async () => {
      const user = (await createTestUser()) as TEST_USER;
      const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
        app,
        user.email,
        VALID_PASSWORD,
      );
      const csrf = cookies["CSRF-TOKEN"] as string;

      const createdProblem = await createTestProblem({
        user,
        accessToken,
        cookieHeader,
        csrfTokenValue: csrf,
        opts: { autoReminders: false },
      });

      const problemId = createdProblem.problem_id as number;

      // simulate client sending different date formats (we send full ISO and date-only)
      const dateObjIso = new Date("2025-12-01T10:30:00Z").toISOString();
      const res1 = await reqWithCsrf(
        app,
        "post",
        `/api/reminders/${problemId}`,
        accessToken,
        cookieHeader,
        csrf,
        { due_datetime: dateObjIso },
      );
      expect(res1.status).toBe(201);
      const r1 = await testDb("reminders")
        .where({ reminder_id: res1.body.reminder.reminder_id as number })
        .first();
      expect(new Date(r1!.due_datetime).toISOString()).toBe(
        new Date(dateObjIso).toISOString(),
      );

      const dateOnly = "2025-12-02";
      const res2 = await reqWithCsrf(
        app,
        "post",
        `/api/reminders/${problemId}`,
        accessToken,
        cookieHeader,
        csrf,
        { due_datetime: dateOnly },
      );

      expect(res2.status).toBe(400);
      const rows = await testDb("reminders").select("*");
      // at least one reminder exists from res1. Ensure res2 didn't add another
      const count = rows.filter((r) => r.problem_id === problemId).length;
      expect(count).toBe(1);
    });
  });

  describe("GET /reminders", () => {
    test("success: owner can fetch their reminder", async () => {
      const user = (await createTestUser()) as TEST_USER;
      const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
        app,
        user.email,
        VALID_PASSWORD,
      );
      const csrf = cookies["CSRF-TOKEN"] as string;

      // seed a problem
      const problem = await createTestProblem({
        user,
        accessToken,
        cookieHeader,
        csrfTokenValue: csrf,
        opts: { name: "ForReminder", autoReminders: false },
      });

      const problemId = problem.problem_id as number;

      // create a reminder
      const dueIso = "2025-11-01T09:00:00Z";
      const createRes = await reqWithCsrf(
        app,
        "post",
        `/api/reminders/${problemId}`,
        accessToken,
        cookieHeader,
        csrf,
        { due_datetime: dueIso },
      );

      expect(createRes.status).toBe(201);
      const created = createRes.body.reminder as Partial<IReminderRow>;
      const reminderId = created.reminder_id as number;

      console.log("CREATED REMINDER ", createRes.body);

      // GET the reminder
      const getRes = await request(app)
        .get(`/api/reminders/${reminderId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      console.log("GET RES ", getRes.body);

      expect(getRes.body).toHaveProperty("reminder");
      const r = getRes.body.reminder as IReminderRow;
      expect(r.reminder_id).toBe(reminderId);
      expect(r.problem_id).toBe(problemId);
      expect(new Date(r.due_datetime).toISOString()).toBe(
        new Date(dueIso).toISOString(),
      );
    });

    test("unauthorized: missing access token -> 401", async () => {
      const user = (await createTestUser()) as TEST_USER;
      const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
        app,
        user.email,
        VALID_PASSWORD,
      );
      const csrf = cookies["CSRF-TOKEN"] as string;

      // seed problem and reminder
      const problem = await createTestProblem({
        user,
        accessToken,
        cookieHeader,
        csrfTokenValue: csrf,
        opts: { autoReminders: false },
      });

      const createRes = await reqWithCsrf(
        app,
        "post",
        `/api/reminders/${problem.problem_id}`,
        accessToken,
        cookieHeader,
        csrf,
        { due_datetime: "2025-11-01T09:00:00Z" },
      );
      expect(createRes.status).toBe(201);
      const reminderId = createRes.body.reminder.reminder_id as number;

      // GET without Authorization header
      const res = await request(app)
        .get(`/api/reminders/${reminderId}`)
        .expect(401);
      // Optionally assert error shape
      expect(res.body).toHaveProperty("error");
    });

    test("not found: nonexistent reminder -> 404", async () => {
      const user = (await createTestUser()) as TEST_USER;
      const { accessToken } = await loginAndGetCsrf(
        app,
        user.email,
        VALID_PASSWORD,
      );

      const missingId = 999999;
      await request(app)
        .get(`/api/reminders/${missingId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(404);
    });

    test("ownership: user B cannot fetch user A's reminder (404)", async () => {
      // user A
      const userA = (await createTestUser()) as TEST_USER;
      const {
        accessToken: tokenA,
        cookies: cookiesA,
        cookieHeader: cookieHeaderA,
      } = await loginAndGetCsrf(app, userA.email, VALID_PASSWORD);
      const csrfA = cookiesA["CSRF-TOKEN"] as string;

      // seed problem and reminder as user A
      const problemA = await createTestProblem({
        user: userA,
        accessToken: tokenA,
        cookieHeader: cookieHeaderA,
        csrfTokenValue: csrfA,
        opts: { autoReminders: false },
      });
      const createRes = await reqWithCsrf(
        app,
        "post",
        `/api/reminders/${problemA.problem_id}`,
        tokenA,
        cookieHeaderA,
        csrfA,
        {
          due_datetime: "2025-11-01T09:00:00Z",
        },
      );
      expect(createRes.status).toBe(201);
      const reminderId = createRes.body.reminder.reminder_id as number;

      // user B
      const userB = (await createTestUser(
        "User B",
        "testuser2@example.com",
      )) as TEST_USER;
      const { accessToken: tokenB } = await loginAndGetCsrf(
        app,
        userB.email,
        VALID_PASSWORD,
      );

      // user B attempts to GET A's reminder — expect 404 to follow problems tests' semantics
      await request(app)
        .get(`/api/reminders/${reminderId}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(404);
    });
  });

  describe("PUT /api/reminders", () => {
    test("update due_datetime", async () => {
      const user = (await createTestUser()) as TEST_USER;
      const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
        app,
        user.email,
        VALID_PASSWORD,
      );
      const csrf = cookies["CSRF-TOKEN"] as string;

      // seed problem
      const problem = await createTestProblem({
        user,
        accessToken,
        cookieHeader,
        csrfTokenValue: csrf,
        opts: { name: "ForUpdate", autoReminders: false },
      });
      const problemId = problem.problem_id as number;

      // create reminder
      const createRes = await reqWithCsrf(
        app,
        "post",
        `/api/reminders/${problemId}`,
        accessToken,
        cookieHeader,
        csrf,
        { due_datetime: "2025-11-01T09:00:00Z" },
      );
      expect(createRes.status).toBe(201);
      const reminder = createRes.body.reminder as IReminderRow;

      // update due datetime
      const newDue = "2025-12-01T10:00:00Z";
      const putRes = await reqWithCsrf(
        app,
        "put",
        `/api/reminders/${reminder.reminder_id}`,
        accessToken,
        cookieHeader,
        csrf,
        { due_datetime: newDue },
      );

      expect(putRes.status).toBe(200);
      expect(putRes.body).toHaveProperty("reminder");
      const updated = putRes.body.reminder as IReminderRow;
      expect(new Date(updated.due_datetime).toISOString()).toBe(
        new Date(newDue).toISOString(),
      );

      // verify DB
      const dbRow = await testDb("reminders")
        .where({ reminder_id: reminder.reminder_id })
        .first();
      expect(dbRow).toBeDefined();
      expect(new Date(dbRow!.due_datetime).toISOString()).toBe(
        new Date(newDue).toISOString(),
      );
    });

    test("mark as completed sets completed_at; unmark clears it", async () => {
      const user = (await createTestUser()) as TEST_USER;
      const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
        app,
        user.email,
        VALID_PASSWORD,
      );
      const csrf = cookies["CSRF-TOKEN"] as string;

      // seed problem & reminder
      const problem = await createTestProblem({
        user,
        accessToken,
        cookieHeader,
        csrfTokenValue: csrf,
        opts: { name: "CompleteTest", autoReminders: false },
      });

      const createRes = await reqWithCsrf(
        app,
        "post",
        `/api/reminders/${problem.problem_id}`,
        accessToken,
        cookieHeader,
        csrf,
        { due_datetime: "2025-11-01T09:00:00Z" },
      );

      expect(createRes.status).toBe(201);
      const reminderId = createRes.body.reminder.reminder_id as number;

      // mark completed
      const compRes = await reqWithCsrf(
        app,
        "put",
        `/api/reminders/${reminderId}`,
        accessToken,
        cookieHeader,
        csrf,
        { is_completed: true },
      );
      expect(compRes.status).toBe(200);
      const compRow = compRes.body.reminder as IReminderRow;
      expect(compRow.is_completed).toBe(1); // True as represented by sqlite
      expect(compRow.completed_at).toBeTruthy();
      // completed_at should be parseable ISO
      expect(() =>
        new Date(compRow.completed_at as Date).toISOString(),
      ).not.toThrow();

      // now unmark completed
      const unmarkRes = await reqWithCsrf(
        app,
        "put",
        `/api/reminders/${reminderId}`,
        accessToken,
        cookieHeader,
        csrf,
        { is_completed: false },
      );
      expect(unmarkRes.status).toBe(200);
      const unRow = unmarkRes.body.reminder as IReminderRow;
      expect(unRow.is_completed).toBe(0);
      expect(unRow.completed_at).toBeNull();
    });

    test("validation: invalid due_datetime -> 400 and DB unchanged", async () => {
      const user = (await createTestUser()) as TEST_USER;
      const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
        app,
        user.email,
        VALID_PASSWORD,
      );
      const csrf = cookies["CSRF-TOKEN"] as string;

      const problem = await createTestProblem({
        user,
        accessToken,
        cookieHeader,
        csrfTokenValue: csrf,
        opts: { autoReminders: false },
      });
      const createRes = await reqWithCsrf(
        app,
        "post",
        `/api/reminders/${problem.problem_id}`,
        accessToken,
        cookieHeader,
        csrf,
        { due_datetime: "2025-11-01T09:00:00Z" },
      );
      expect(createRes.status).toBe(201);
      const reminderId = createRes.body.reminder.reminder_id as number;

      const badRes = await reqWithCsrf(
        app,
        "put",
        `/api/reminders/${reminderId}`,
        accessToken,
        cookieHeader,
        csrf,
        { due_datetime: "not-a-date" },
      );
      expect(badRes.status).toBe(400);

      // DB should remain unchanged (due_datetime still the original)
      const dbRow = await testDb("reminders")
        .where({ reminder_id: reminderId })
        .first();
      expect(new Date(dbRow!.due_datetime).toISOString()).toBe(
        new Date("2025-11-01T09:00:00Z").toISOString(),
      );
    });

    test("bad request: no updatable fields -> 400", async () => {
      const user = (await createTestUser()) as TEST_USER;
      const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
        app,
        user.email,
        VALID_PASSWORD,
      );
      const csrf = cookies["CSRF-TOKEN"] as string;

      const problem = await createTestProblem({
        user,
        accessToken,
        cookieHeader,
        csrfTokenValue: csrf,
        opts: { autoReminders: false },
      });
      const createRes = await reqWithCsrf(
        app,
        "post",
        `/api/reminders/${problem.problem_id}`,
        accessToken,
        cookieHeader,
        csrf,
        { due_datetime: "2025-11-01T09:00:00Z" },
      );
      expect(createRes.status).toBe(201);
      const reminderId = createRes.body.reminder.reminder_id as number;

      const res = await reqWithCsrf(
        app,
        "put",
        `/api/reminders/${reminderId}`,
        accessToken,
        cookieHeader,
        csrf,
        { foo: "bar" }, // irrelevant field
      );
      expect(res.status).toBe(400);
    });

    test("unauthorized: missing token -> 401", async () => {
      const user = (await createTestUser()) as TEST_USER;
      const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
        app,
        user.email,
        VALID_PASSWORD,
      );
      const csrf = cookies["CSRF-TOKEN"] as string;

      const problem = await createTestProblem({
        user,
        accessToken,
        cookieHeader,
        csrfTokenValue: csrf,
        opts: { autoReminders: false },
      });
      const createRes = await reqWithCsrf(
        app,
        "post",
        `/api/reminders/${problem.problem_id}`,
        accessToken,
        cookieHeader,
        csrf,
        {
          problem_id: problem.problem_id,
          due_datetime: "2025-11-01T09:00:00Z",
        },
      );
      expect(createRes.status).toBe(201);
      const reminderId = createRes.body.reminder.reminder_id as number;

      // missing token => expect 401
      const res = await reqWithCsrf(
        app,
        "put",
        `/api/reminders/${reminderId}`,
        null /* accessToken */,
        cookieHeader,
        csrf,
        { is_completed: true },
      );
      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /api/reminders", () => {
    test("success: deletes reminder and returns 200", async () => {
      const user = (await createTestUser()) as TEST_USER;
      const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
        app,
        user.email,
        VALID_PASSWORD,
      );
      const csrf = cookies["CSRF-TOKEN"] as string;

      const problem = await createTestProblem({
        user,
        accessToken,
        cookieHeader,
        csrfTokenValue: csrf,
        opts: { autoReminders: false },
      });

      const createRes = await reqWithCsrf(
        app,
        "post",
        `/api/reminders/${problem.problem_id}`,
        accessToken,
        cookieHeader,
        csrf,
        { due_datetime: "2025-11-01T09:00:00Z" },
      );
      expect(createRes.status).toBe(201);
      const reminderId = createRes.body.reminder.reminder_id as number;

      const delRes = await reqWithCsrf(
        app,
        "delete",
        `/api/reminders/${reminderId}`,
        accessToken,
        cookieHeader,
        csrf,
      );

      expect(delRes.status).toBe(200);

      const dbRow = await testDb("reminders")
        .where({ reminder_id: reminderId })
        .first();
      expect(dbRow).toBeUndefined();
    });

    test("unauthorized: missing token -> 401", async () => {
      const user = (await createTestUser()) as TEST_USER;
      const { accessToken, cookies, cookieHeader } = await loginAndGetCsrf(
        app,
        user.email,
        VALID_PASSWORD,
      );
      const csrf = cookies["CSRF-TOKEN"] as string;

      const problem = await createTestProblem({
        user,
        accessToken,
        cookieHeader,
        csrfTokenValue: csrf,
        opts: { autoReminders: false },
      });

      const createRes = await reqWithCsrf(
        app,
        "post",
        `/api/reminders/${problem.problem_id}`,
        accessToken,
        cookieHeader,
        csrf,
        { due_datetime: "2025-11-01T09:00:00Z" },
      );
      expect(createRes.status).toBe(201);
      const reminderId = createRes.body.reminder.reminder_id as number;

      const res = await reqWithCsrf(
        app,
        "delete",
        `/api/reminders/${reminderId}`,
        null /* accessToken */,
        cookieHeader,
        csrf,
      );
      expect(res.status).toBe(401);
    });

    test("not found & ownership: deleting non-existent or other's reminder -> 404", async () => {
      // seed a reminder as user A
      const userA = (await createTestUser()) as TEST_USER;
      const {
        accessToken: tokenA,
        cookies: cookiesA,
        cookieHeader: cookieHeaderA,
      } = await loginAndGetCsrf(app, userA.email, VALID_PASSWORD);
      const csrfA = cookiesA["CSRF-TOKEN"] as string;

      const problemA = await createTestProblem({
        user: userA,
        accessToken: tokenA,
        cookieHeader: cookieHeaderA,
        csrfTokenValue: csrfA,
        opts: { autoReminders: false },
      });

      const createRes = await reqWithCsrf(
        app,
        "post",
        `/api/reminders/${problemA.problem_id}`,
        tokenA,
        cookieHeaderA,
        csrfA,
        {
          problem_id: problemA.problem_id,
          due_datetime: "2025-11-01T09:00:00Z",
        },
      );
      expect(createRes.status).toBe(201);
      const reminderId = createRes.body.reminder.reminder_id as number;

      // user B attempts delete -> 404
      const userB = (await createTestUser(
        "User B",
        "testuser2@example.com",
      )) as TEST_USER;
      const {
        accessToken: tokenB,
        cookies: cookiesB,
        cookieHeader: cookieHeaderB,
      } = await loginAndGetCsrf(app, userB.email, VALID_PASSWORD);
      const csrfB = cookiesB["CSRF-TOKEN"];

      const resB = await reqWithCsrf(
        app,
        "delete",
        `/api/reminders/${reminderId}`,
        tokenB,
        cookieHeaderB,
        csrfB,
      );
      expect(resB.status).toBe(404);

      // deleting non-existent id
      const resMissing = await reqWithCsrf(
        app,
        "delete",
        `/api/reminders/9999999`,
        tokenA,
        cookieHeaderA,
        csrfA,
      );
      expect(resMissing.status).toBe(404);
    });
  });
});
