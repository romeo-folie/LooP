/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import request from "supertest";
import app from "../src/app";
import { db } from "../src/db";
import {
  generateExpiredRefreshToken,
  generatePasswordResetToken,
  generateRefreshToken,
} from "../src/utils/jwt";
import crypto from "crypto";
import bcrypt from "bcrypt";

process.env.NODE_ENV = "test";

beforeAll(async () => {
  await db.migrate.latest();
  // await db.seed.run();
});

afterAll(async () => {
  await db.destroy();
});

describe("authentication tests", () => {
  const validEmail = "testuser@example.com";
  const validEmail2 = "testuser2@example.com";
  const validEmail3 = "testuser3@example.com";
  const validEmail4 = "testuser4@example.com";
  const validPassword = "testPassw0rD%";

  describe("user registration", () => {
    it("should return 400 with errors if password is invalid", async () => {
      const response = await request(app).post("/api/auth/register").send({
        name: "Test User",
        email: validEmail,
        password: "testpassword",
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual(
        expect.objectContaining({
          error: "Validation failed",
          issues: expect.arrayContaining([
            expect.objectContaining({
              code: "invalid_format",
              message: "Password must contain at least one uppercase letter",
              path: "password", // if your middleware flattens to string
            }),
            expect.objectContaining({
              code: "invalid_format",
              message: "Password must contain at least one digit",
              path: "password",
            }),
            expect.objectContaining({
              code: "invalid_format",
              message:
                "Password must contain at least one special character (@$!%*?&)",
              path: "password",
            }),
          ]),
        }),
      );
    });

    it("should return 400 if email is invalid", async () => {
      const response = await request(app).post("/api/auth/register").send({
        name: "Test User",
        email: "testuserexample.com",
        password: "testPassw0rD%",
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual(
        expect.objectContaining({
          error: "Validation failed",
          issues: expect.arrayContaining([
            expect.objectContaining({
              code: "invalid_format",
              message: "Invalid email address",
              path: "email",
            }),
          ]),
        }),
      );
    });

    it("should successfully create a new user", async () => {
      const response = await request(app).post("/api/auth/register").send({
        name: "Test User",
        email: validEmail,
        password: validPassword,
      });

      // Added to aid further testing below
      await request(app).post("/api/auth/register").send({
        name: "Test User2",
        email: validEmail2,
        password: validPassword,
      });

      await request(app).post("/api/auth/register").send({
        name: "Test User3",
        email: validEmail3,
        password: validPassword,
      });

      await request(app).post("/api/auth/register").send({
        name: "Test User4",
        email: validEmail4,
        password: validPassword,
      });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("User registered successfully");
    });

    it("should return a 400 if email is already in use", async () => {
      const response = await request(app).post("/api/auth/register").send({
        name: "Test User",
        email: validEmail,
        password: "testPassw0rD%",
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Email already in use");
    });
  });

  describe("user login", () => {
    it("should return 401 for wrong password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: "testuser@example.com", password: "testPassw0rd!" });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid credentials");
    });

    it("should return 401 if user does not exist", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: "testuser@wrongmail.com", password: "testPassw0rd!" });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid credentials");
    });

    it("should return 400 for missing fields", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: "" });

      expect(response.status).toBe(400);
      expect(response.body).toEqual(
        expect.objectContaining({
          error: "Validation failed",
          issues: expect.arrayContaining([
            expect.objectContaining({
              code: "invalid_format",
              message: "Invalid email address",
              path: "email",
            }),
            expect.objectContaining({
              code: "invalid_type",
              message: "Invalid input: expected string, received undefined",
              path: "password",
            }),
          ]),
        }),
      );
    });

    it("should log user in if they exist and the credentials are valid", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: "testuser@example.com", password: "testPassw0rD%" });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Login successful");
    });
  });

  describe("token refresh", () => {
    let validRefreshToken: string;
    let expiringSoonRefreshToken: string;
    let expiredRefreshToken: string;
    const invalidRefreshToken = "invalid.token.string";

    beforeAll(async () => {
      validRefreshToken = generateRefreshToken({ userId: 1 }, "15m"); // Valid 15-min token
      expiringSoonRefreshToken = generateRefreshToken({ userId: 1 }, "1m"); // Expiring in 1 min
      expiredRefreshToken = generateExpiredRefreshToken({ userId: 1 }); // Already expired
    });

    it("Should return 403 when refresh token is expired", async () => {
      const res = await request(app)
        .post("/api/auth/refresh-token")
        .set("Cookie", `refresh_token=${expiredRefreshToken}`)
        .send();

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty(
        "error",
        "Invalid or expired refresh token",
      );
    });

    it("Should return 403 when refresh token is tampered or invalid", async () => {
      const res = await request(app)
        .post("/api/auth/refresh-token")
        .set("Cookie", `refresh_token=${invalidRefreshToken}`)
        .send();

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty(
        "error",
        "Invalid or expired refresh token",
      );
    });

    it("Should return 400 when no refresh token is provided", async () => {
      const res = await request(app).post("/api/auth/refresh-token").send();

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Refresh token is required");
    });

    it("Should return a new access token when refresh token is valid and from a signed in user", async () => {
      // Step 1: Sign in to get a refresh token
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: validEmail, password: validPassword });

      expect(loginRes.status).toBe(200);
      expect(loginRes.headers["set-cookie"]).toBeDefined();

      // Extract the refresh token from cookies
      const cookies = loginRes.headers["set-cookie"];
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      const refreshTokenCookie = cookieArray.find((cookie: string) =>
        cookie.startsWith("refresh_token"),
      );

      expect(refreshTokenCookie).toBeDefined();

      // Step 2: Send refresh token request
      const response = await request(app)
        .post("/api/auth/refresh-token")
        .set("Cookie", refreshTokenCookie)
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("token");
      expect(typeof response.body.token).toBe("string");
    });
  });

  describe("forgot password", () => {
    describe("Requesting a OTP", () => {
      describe("No email provided", () => {
        it("should return 400 if email is missing", async () => {
          const res = await request(app)
            .post("/api/auth/forgot-password")
            .send({});

          expect(res.status).toBe(400);
          expect(res.body).toEqual(
            expect.objectContaining({
              error: "Validation failed",
              issues: expect.arrayContaining([
                expect.objectContaining({
                  code: "invalid_type",
                  message: "a valid email is required",
                  path: "email", // if your middleware flattens Zod's path
                }),
              ]),
            }),
          );
        });
      });

      describe("Email does not exist in DB", () => {
        it("should return 200 with a generic message", async () => {
          const res = await request(app)
            .post("/api/auth/forgot-password")
            .send({ email: "nonexistent@example.com" });

          // Should not reveal user existence, so return 200
          expect(res.status).toBe(200);
          expect(res.body).toHaveProperty(
            "message",
            "If the email exists, an OTP has been sent.",
          );
        });
      });

      describe("Valid Email", () => {
        it("should return 200 and send OTP for an existing user", async () => {
          const res = await request(app)
            .post("/api/auth/forgot-password")
            .send({ email: validEmail });

          expect(res.status).toBe(200);
          expect(res.body).toHaveProperty(
            "message",
            "If the email exists, an OTP has been sent.",
          );

          const user = await db("users").where({ email: validEmail }).first();
          const otpRecord = await db("password_reset_tokens")
            .where({ user_id: user!.user_id })
            .orderBy("created_at", "desc")
            .first();

          expect(otpRecord).toBeTruthy();
        });
      });

      describe("Multiple requests for the same email", () => {
        it("should handle repeated requests gracefully", async () => {
          const firstRes = await request(app)
            .post("/api/auth/forgot-password")
            .send({ email: validEmail });

          expect(firstRes.status).toBe(200);

          const countBefore = await db("password_reset_tokens")
            .select<{
              otpRecordCountBefore: number;
            }>(db.raw('COUNT(*) AS "otpRecordCountBefore"'))
            .first();

          // Immediately request again
          const secondRes = await request(app)
            .post("/api/auth/forgot-password")
            .send({ email: validEmail });

          expect(secondRes.status).toBe(200);

          const countAfter = await db("password_reset_tokens")
            .select<{
              otpRecordCountAfter: number;
            }>(db.raw('COUNT(*) AS "otpRecordCountAfter"'))
            .first();

          expect(
            countAfter?.otpRecordCountAfter ===
              (countBefore?.otpRecordCountBefore || 0) + 1,
          );
        });
      });
    });

    describe("Verifying OTP", () => {
      describe("No Email or OTP Provided", () => {
        it("should return 400 if email and otp are missing", async () => {
          const res = await request(app).post("/api/auth/verify-otp").send({}); // no email, no otp

          expect(res.status).toBe(400);
          expect(res.body).toEqual(
            expect.objectContaining({
              error: "Validation failed",
              issues: expect.arrayContaining([
                expect.objectContaining({
                  code: "invalid_type",
                  message: "a valid email is required",
                  path: "email",
                }),
                expect.objectContaining({
                  code: "invalid_type",
                  message: "Invalid input: expected string, received undefined",
                  path: "pin",
                }),
              ]),
            }),
          );
        });
      });

      describe("Email Not Found", () => {
        it("should return 400 if email does not match any user", async () => {
          const res = await request(app)
            .post("/api/auth/verify-otp")
            .send({ email: "unknown@example.com", pin: "123456" });

          expect(res.status).toBe(400);
          expect(res.body).toHaveProperty("error", "Invalid email or OTP");
        });
      });

      describe("OTP Record Does Not Exist", () => {
        it("should return 400 if there is no OTP record for this user", async () => {
          const res = await request(app)
            .post("/api/auth/verify-otp")
            .send({ email: validEmail2, pin: "654321" });

          expect(res.status).toBe(400);
          expect(res.body).toHaveProperty("error", "OTP expired or invalid");
        });
      });

      describe("OTP Expired", () => {
        it("should return 400 if the OTP record has passed its expires_at time", async () => {
          const user = await db("users").where({ email: validEmail2 }).first();

          const hashedOtp = crypto
            .createHash("sha256")
            .update("222222")
            .digest("hex");

          await db("password_reset_tokens").insert({
            user_id: user!.user_id,
            otp_hash: hashedOtp,
            expires_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          });

          const res = await request(app)
            .post("/api/auth/verify-otp")
            .send({ email: validEmail2, pin: "222222" });

          expect(res.status).toBe(400);
          expect(res.body).toHaveProperty("error", "OTP expired or invalid");
        });
      });

      describe("OTP Mismatch", () => {
        it("should return 400 if provided OTP does not match stored hash", async () => {
          const user = await db("users").where({ email: validEmail3 }).first();

          const hashedOtp = crypto
            .createHash("sha256")
            .update("555555")
            .digest("hex");

          await db("password_reset_tokens").insert({
            user_id: user!.user_id,
            otp_hash: hashedOtp,
            expires_at: new Date(Date.now() + 10 * 60 * 1000),
          });

          const res = await request(app)
            .post("/api/auth/verify-otp")
            .send({ email: validEmail3, pin: "555556" });

          expect(res.status).toBe(400);
          expect(res.body).toHaveProperty("error", "Invalid OTP");
        });
      });

      describe("Valid OTP", () => {
        it("should return 200 and include a password_reset_token if OTP is correct", async () => {
          const user = await db("users").where({ email: validEmail4 }).first();

          const hashedOtp = crypto
            .createHash("sha256")
            .update("333333")
            .digest("hex");

          await db("password_reset_tokens").insert({
            user_id: user!.user_id,
            otp_hash: hashedOtp,
            expires_at: new Date(Date.now() + 10 * 60 * 1000),
          });

          const res = await request(app)
            .post("/api/auth/verify-otp")
            .send({ email: validEmail4, pin: "333333" });

          expect(res.status).toBe(200);
          expect(res.body).toHaveProperty(
            "message",
            "OTP verified successfully",
          );
          expect(res.body).toHaveProperty("password_reset_token");
        });
      });
    });

    describe("Resetting Password", () => {
      const validToken = generatePasswordResetToken(
        {
          userId: 4,
          email: validEmail4,
        },
        "1s",
      );

      describe("No Reset Token or No New Password", () => {
        it("should return 400 if token is missing", async () => {
          const res = await request(app)
            .post("/api/auth/reset-password")
            .send({ new_password: validPassword });

          expect(res.status).toBe(400);
          expect(res.body).toEqual(
            expect.objectContaining({
              error: "Validation failed",
              issues: expect.arrayContaining([
                expect.objectContaining({
                  code: "invalid_type",
                  message: "Invalid input: expected string, received undefined",
                  path: "password_reset_token",
                }),
              ]),
            }),
          );
        });

        it("should return 400 if new_password is missing", async () => {
          const res = await request(app)
            .post("/api/auth/reset-password")
            .send({ password_reset_token: "someToken" });

          expect(res.status).toBe(400);
          expect(res.body).toEqual(
            expect.objectContaining({
              error: "Validation failed",
              issues: expect.arrayContaining([
                expect.objectContaining({
                  code: "invalid_type",
                  message: "Invalid input: expected string, received undefined",
                  path: "new_password",
                }),
              ]),
            }),
          );
        });
      });

      describe("Invalid or Expired Token", () => {
        it("should return 403 if token is invalid or expired", async () => {
          const expiredToken = generatePasswordResetToken(
            { userId: 4, email: validEmail4 },
            "-1s",
          );

          const res = await request(app).post("/api/auth/reset-password").send({
            password_reset_token: expiredToken,
            new_password: validPassword,
          });

          expect(res.status).toBe(403);
          expect(res.body).toHaveProperty("error", "Invalid or expired token");
        });
      });

      describe("Password Strength Validation", () => {
        it("should return 400 if new password is too weak", async () => {
          const res = await request(app).post("/api/auth/reset-password").send({
            password_reset_token: validToken,
            new_password: "abc",
          });

          expect(res.status).toBe(400);
          expect(res.body).toEqual(
            expect.objectContaining({
              error: "Validation failed",
              issues: expect.arrayContaining([
                expect.objectContaining({
                  code: "too_small",
                  message: "Password must be at least 6 characters long",
                  path: "new_password",
                }),
                expect.objectContaining({
                  code: "invalid_format",
                  message:
                    "Password must contain at least one uppercase letter",
                  path: "new_password",
                }),
                expect.objectContaining({
                  code: "invalid_format",
                  message: "Password must contain at least one number",
                  path: "new_password",
                }),
                expect.objectContaining({
                  code: "invalid_format",
                  message:
                    "Password must contain at least one special character (@$!%*?&#)",
                  path: "new_password",
                }),
              ]),
            }),
          );
        });

        describe("Successful Password Reset", () => {
          it("should return 200 and update user’s password in DB", async () => {
            const validToken = generatePasswordResetToken({
              userId: 4,
              email: validEmail4,
            });

            const newPass = "StrongPass@1!";
            const res = await request(app)
              .post("/api/auth/reset-password")
              .send({
                password_reset_token: validToken,
                new_password: newPass,
              });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty(
              "message",
              "Password reset successfully. You can now log in.",
            );

            const user = await db("users").where({ user_id: 4 }).first();
            const match = await bcrypt.compare(newPass, user!.password);
            expect(match).toBe(true);
          });
        });

        describe("Token Reuse", () => {
          it("should fail if attempting to reuse the same token again", async () => {
            // TODO:Might cause failures
            // set token to expire after a second, so should be expired by the test runner gets here
            // not the best implementation but works for now
            const usedToken = validToken;

            const res = await request(app)
              .post("/api/auth/reset-password")
              .send({
                password_reset_token: usedToken,
                new_password: "AnotherStrongPass1!",
              });

            expect(res.status).toBe(403);
            expect(res.body).toHaveProperty(
              "error",
              "Invalid or expired token",
            );
          });
        });
      });
    });
  });
});
