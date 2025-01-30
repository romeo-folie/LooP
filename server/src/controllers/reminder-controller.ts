import { Response, RequestHandler } from 'express';
import { AuthenticatedRequest } from '../types/authenticated-request';
import { db } from '../db';
import { validationResult } from 'express-validator';

export const getRemindersByProblem: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.authUser?.userId;
    const { problem_id } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Ensure the problem exists and belongs to the authenticated user
    const problem = await db('problems')
      .where({ problem_id, user_id: userId })
      .first();

    if (!problem) {
      res.status(404).json({ error: 'Problem not found' });
      return;
    }

    // Fetch reminders for the problem
    const reminders = await db('reminders')
      .where({ problem_id, user_id: userId })
      .select('reminder_id', 'due_date', 'is_sent', 'sent_at', 'is_completed', 'completed_at', 'created_at');

    res.status(200).json({ reminders });
  } catch (error: unknown) {
    console.error(
      'Get reminders by problem ID error:',
      error instanceof Error ? error.message : error
    );
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getReminderById: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.authUser?.userId;
    const { reminder_id } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Fetch the reminder belonging to the authenticated user
    const reminder = await db('reminders')
      .where({ reminder_id, user_id: userId })
      .first();

    if (!reminder) {
      res.status(404).json({ error: 'Reminder not found' });
      return;
    }

    res.status(200).json({ reminder });
  } catch (error: unknown) {
    console.error(
      'Get reminder by ID error:',
      error instanceof Error ? error.message : error
    );
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createReminder: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const userId = req.authUser?.userId;
    const { problem_id } = req.params;
    const { due_datetime } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const existingProblem = await db('problems')
      .where({ problem_id, user_id: userId })
      .first();

    if (!existingProblem) {
      res.status(404).json({ error: 'Problem not found' });
      return;
    }

    const [newReminder] = await db('reminders')
      .insert({
        problem_id,
        user_id: userId,
        due_datetime
      })
      .returning([
        'reminder_id',
        'problem_id',
        'due_datetime',
        'is_sent',
        'sent_at',
        'is_completed',
        'completed_at',
        'created_at'
      ]);

    res.status(201).json({
      message: 'Reminder created successfully',
      reminder: newReminder
    });
  } catch (error: unknown) {
    console.error(
      'Create reminder error:',
      error instanceof Error ? error.message : error
    );
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateReminder: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const userId = req.authUser?.userId;
    const { reminder_id } = req.params;
    const { due_datetime, is_completed } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const existingReminder = await db('reminders')
      .where({ reminder_id, user_id: userId })
      .first();

    if (!existingReminder) {
      res.status(404).json({ error: 'Reminder not found' });
      return;
    }

    const updatedFields: Record<string, any> = {};
    if (due_datetime) updatedFields.due_datetime = due_datetime;
    if (is_completed !== undefined) {
      updatedFields.is_completed = is_completed;
      updatedFields.completed_at = is_completed ? new Date() : null;
    }

    const [updatedReminder] = await db('reminders')
      .where({ reminder_id, user_id: userId })
      .update(updatedFields)
      .returning([
        'reminder_id',
        'problem_id',
        'due_date',
        'is_sent',
        'sent_at',
        'is_completed',
        'completed_at',
        'updated_at'
      ]);

    res.status(200).json({
      message: 'Reminder updated successfully',
      reminder: updatedReminder
    });
  } catch (error: unknown) {
    console.error(
      'Update reminder error:',
      error instanceof Error ? error.message : error
    );
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteReminder: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.authUser?.userId;
    const { reminder_id } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Ensure the reminder exists and belongs to the authenticated user
    const existingReminder = await db('reminders')
      .where({ reminder_id, user_id: userId })
      .first();

    if (!existingReminder) {
      res.status(404).json({ error: 'Reminder not found' });
      return;
    }

    // Delete the reminder
    await db('reminders').where({ reminder_id }).del();

    res.status(200).json({ message: 'Reminder deleted successfully' });
  } catch (error: unknown) {
    console.error(
      'Delete reminder error:',
      error instanceof Error ? error.message : error
    );
    res.status(500).json({ error: 'Internal server error' });
  }
};