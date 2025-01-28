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