import { z } from "zod";

export const registerSchema = z.object({
  name: z
    .string("Name must be a string")
    .min(2, "Name must be at least 2 characters"),
  email: z.email("Invalid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/\d/, "Password must contain at least one digit")
    .regex(
      /[!@#$%^&*(),.?":{}|<>]/,
      "Password must contain at least one special character (@$!%*?&)",
    ),
});

export const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/\d/, "Password must contain at least one digit")
    .regex(
      /[!@#$%^&*(),.?":{}|<>]/,
      "Password must contain at least one special character (@$!%*?&)",
    ),
});

export const createProblemSchema = z.object({
  name: z.string().min(3, "Problem name is required"),
  difficulty: z.enum(
    ["Easy", "Medium", "Hard"],
    "Difficulty must be one of: Easy, Medium, Hard",
  ),
  tags: z.array(z.string()).min(1, "At least one tag is required").default([]),
  date_solved: z.string(),
  notes: z.string().optional(),
});

export const practiceFeedbackSchema = z.object({
  quality_score: z
    .number("quality score must be an integer between 1 and 5")
    .gte(1)
    .lte(5),
});

export const createReminderSchema = z.object({
  due_datetime: z.iso.datetime(
    "due_datetime is required and must be ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)",
  ),
  is_completed: z.boolean("is_completed must be a boolean").optional(),
});

export const createSubscriptionSchema = z.object({
  endpoint: z.string("Endpoint is required"),
  public_key: z.string("Public key is required"),
  auth: z.string("Auth key is required"),
});

export const deleteSubscriptionSchema = z.object({
  endpoint: z.string("endpoint is required for subscription deletion"),
});

export const forgotPasswordSchema = z.object({
  email: z.email("a valid email is required"),
});

export const verifyOtpSchema = z.object({
  email: z.email("a valid email is required"),
  pin: z.string().length(6, "OTP must be exactly 6 digits"),
});

export const resetPasswordSchema = z.object({
  password_reset_token: z.string(),
  new_password: z
    .string()
    .min(6, "Password must be at least 6 characters long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/\d/, "Password must contain at least one number")
    .regex(
      /[@$!%*?&#]/,
      "Password must contain at least one special character (@$!%*?&#)",
    ),
});

export const preferenceSchema = z.object({
  settings: z.record(z.string(), z.any()),
});
