// src/middlewares/registerValidation.ts
import { body, ValidationChain } from 'express-validator';

export const registerValidation: ValidationChain[] = [
  // Validate the 'name' field
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required'),

  // Validate the 'email' field
  body('email')
    .isEmail()
    .withMessage('Invalid email address'),

  // Validate the 'password' field
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

export const loginValidation: ValidationChain[] = [
  body('email')
    .isEmail()
    .withMessage('Invalid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

export const validateProblemCreation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Problem name is required'),

  body('difficulty')
    .isIn(['Easy', 'Medium', 'Hard'])
    .withMessage('Difficulty must be one of: Easy, Medium, Hard'),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array of strings'),

  body('tags.*')
    .optional()
    .isString()
    .withMessage('Each tag must be a string'),

  body('date_solved')
    .exists({ checkFalsy: true })
    .isISO8601()
    .withMessage('Invalid date format, must be YYYY-MM-DD')
];

export const validateProblemUpdate: ValidationChain[] = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Problem name cannot be empty'),

  body('difficulty')
    .optional()
    .isIn(['Easy', 'Medium', 'Hard'])
    .withMessage('Difficulty must be one of: Easy, Medium, Hard'),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array of strings'),

  body('tags.*')
    .optional()
    .isString()
    .withMessage('Each tag must be a string'),

  body('date_solved')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Invalid date format, must be YYYY-MM-DD'),

  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string')
];

export const validateReminderCreation: ValidationChain[] = [
  body('due_datetime')
    .exists({ checkFalsy: true })
    .withMessage('due_datetime is required')
    .isISO8601()
    .withMessage('Invalid datetime format, must be ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)')
];

export const validateReminderUpdate: ValidationChain[] = [
  body('due_datetime')
    .optional()
    .isISO8601()
    .withMessage('Invalid datetime format, must be ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)'),

  body('is_completed')
    .optional()
    .isBoolean()
    .withMessage('is_completed must be a boolean')
];