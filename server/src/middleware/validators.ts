import { z } from "zod";

// export const registerValidation: ValidationChain[] = [
//   // Validate the 'name' field
//   body("name").trim().notEmpty().withMessage("Name is required"),

//   // Validate the 'email' field
//   body("email").isEmail().withMessage("Invalid email address"),

//   // Validate the 'password' field
//   body("password")
//     .isLength({ min: 6 })
//     .withMessage("Password must be at least 6 characters long")
//     .matches(/\d/)
//     .withMessage("Password must contain at least one number")
//     .matches(/[A-Z]/)
//     .withMessage("Password must contain at least one uppercase letter")
//     .matches(/[!@#$%^&*(),.?":{}|<>]/)
//     .withMessage("Password must contain at least one symbol"),
// ];

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

// export const loginValidation: ValidationChain[] = [
//   body("email").isEmail().withMessage("Invalid email address"),
//   body("password")
//     .notEmpty()
//     .withMessage("Password is required")
//     .isLength({ min: 6 })
//     .withMessage("Password must be at least 6 characters long")
//     .matches(/\d/)
//     .withMessage("Password must contain at least one number")
//     .matches(/[A-Z]/)
//     .withMessage("Password must contain at least one uppercase letter")
//     .matches(/[!@#$%^&*(),.?":{}|<>]/)
//     .withMessage("Password must contain at least one symbol"),
// ];

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

// export const validateProblemCreation = [
//   body("name").trim().notEmpty().withMessage("Problem name is required"),

//   body("difficulty")
//     .isIn(["Easy", "Medium", "Hard"])
//     .withMessage("Difficulty must be one of: Easy, Medium, Hard"),

//   body("tags")
//     .optional()
//     .isArray()
//     .withMessage("Tags must be an array of strings"),

//   body("tags.*").optional().isString().withMessage("Each tag must be a string"),

//   body("date_solved")
//     .exists({ checkFalsy: true })
//     .isISO8601()
//     .withMessage("Invalid date format, must be YYYY-MM-DD"),

//   body("notes").optional().isString().withMessage("Notes must be a string")
// ];

export const createProblemSchema = z.object({
  name: z.string().min(3, "Problem name is required"),
  difficulty: z.enum(
    ["Easy", "Medium", "Hard"],
    "Difficulty must be one of: Easy, Medium, Hard",
  ),
  tags: z.array(z.string()).min(1, "At least one tag is required").default([]),
  date_solved: z.iso.datetime(),
  notes: z.string().optional(),
});

// export const validateProblemUpdate: ValidationChain[] = [
//   body("name")
//     .optional()
//     .trim()
//     .notEmpty()
//     .withMessage("Problem name cannot be empty"),

//   body("difficulty")
//     .optional()
//     .isIn(["Easy", "Medium", "Hard"])
//     .withMessage("Difficulty must be one of: Easy, Medium, Hard"),

//   body("tags")
//     .optional()
//     .isArray()
//     .withMessage("Tags must be an array of strings"),

//   body("tags.*").optional().isString().withMessage("Each tag must be a string"),

//   body("date_solved")
//     .optional()
//     .isISO8601()
//     .toDate()
//     .withMessage("Invalid date format, must be YYYY-MM-DD"),

//   body("notes").optional().isString().withMessage("Notes must be a string"),
// ];

export const updateProblemSchema = z.object({
  name: z.string().min(6, "Password must be at least 6 characters"),
  difficulty: z.enum(
    ["Easy", "Medium", "Hard"],
    "Difficulty must be one of: Easy, Medium, Hard",
  ),
  tags: z.array(z.string()).min(1, "At least one tag is required").default([]),
  date_solved: z.coerce.date(),
  notes: z.string(),
});

// export const validatePracticeFeedback: ValidationChain[] = [
//   body("quality_score")
//     .exists({ checkFalsy: true })
//     .withMessage("quality_score is required")
//     .bail()
//     .isInt({ min: 1, max: 5 })
//     .withMessage("quality_score must be an integer between 1 and 5"),
// ];

export const practiceFeedbackSchema = z.object({
  quality_score: z
    .number("quality score must be an integer between 1 and 5")
    .gte(1)
    .lte(5),
});

// export const validateReminderCreation: ValidationChain[] = [
//   body("due_datetime")
//     .exists({ checkFalsy: true })
//     .withMessage("due_datetime is required")
//     .isISO8601()
//     .withMessage(
//       "Invalid datetime format, must be ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)",
//     ),

//   body("is_completed")
//     .optional()
//     .isBoolean()
//     .withMessage("is_completed must be a boolean"),
// ];

export const createReminderSchema = z.object({
  due_datetime: z.iso.datetime(
    "due_datetime is required and must be ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)",
  ),
  is_completed: z.boolean("is_completed must be a boolean"),
});

// export const validateReminderUpdate: ValidationChain[] = [
//   body("due_datetime")
//     .optional()
//     .isISO8601()
//     .withMessage(
//       "Invalid datetime format, must be ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)",
//     ),

//   body("is_completed")
//     .optional()
//     .isBoolean()
//     .withMessage("is_completed must be a boolean"),
// ];

// export const validateSubscription: ValidationChain[] = [
//   body("endpoint").isString().notEmpty().withMessage("Endpoint is required"),

//   body("public_key")
//     .isString()
//     .notEmpty()
//     .withMessage("Public key is required"),

//   body("auth").isString().notEmpty().withMessage("Auth key is required"),
// ];

export const createSubscriptionSchema = z.object({
  endpoint: z.string("Endpoint is required"),
  public_key: z.string("Public key is required"),
  auth: z.string("Auth key is required"),
});

// export const validateSubscriptionDeletion: ValidationChain[] = [
//   body("endpoint")
//     .isString()
//     .notEmpty()
//     .withMessage("Endpoint is required for subscription deletion"),
// ];

export const deleteSubscriptionSchema = z.object({
  endpoint: z.string("endpoint is required for subscription deletion"),
});

// export const forgotPasswordValidator: ValidationChain[] = [
//   body("email")
//     .trim()
//     .isEmail()
//     .withMessage("A valid email is required")
//     .normalizeEmail(),
// ];

export const forgotPasswordSchema = z.object({
  email: z.email("a valid email is required"),
});

// export const verifyOtpValidator: ValidationChain[] = [
//   body("email")
//     .trim()
//     .isEmail()
//     .withMessage("A valid email is required")
//     .normalizeEmail(),

//   body("pin")
//     .trim()
//     .isLength({ min: 6, max: 6 })
//     .withMessage("OTP must be exactly 6 digits"),
// ];

export const verifyOtpSchema = z.object({
  email: z.email("a valid email is required"),
  pin: z.string().length(6, "OTP must be exactly 6 digits"),
});

// export const resetPasswordValidator: ValidationChain[] = [
//   body("password_reset_token")
//     .trim()
//     .notEmpty()
//     .withMessage("Password reset token is required"),

//   body("new_password")
//     .trim()
//     .isLength({ min: 6 })
//     .withMessage("Password must be at least 6 characters long")
//     .matches(/[A-Z]/)
//     .withMessage("Password must contain at least one uppercase letter")
//     .matches(/[a-z]/)
//     .withMessage("Password must contain at least one lowercase letter")
//     .matches(/\d/)
//     .withMessage("Password must contain at least one number")
//     .matches(/[@$!%*?&#]/)
//     .withMessage(
//       "Password must contain at least one special character (@$!%*?&#)"
//     ),
// ];

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

// export const preferencesValidator = [
//   body("settings")
//     .exists({ checkNull: true })
//     .withMessage("settings is required")
//     .bail()
//     .isObject()
//     .withMessage("settings must be a JSON object"),
// ];

export const preferenceSchema = z.object({
  settings: z.record(z.string(), z.any()),
});
