import { RequestHandler, Response } from 'express';
import { db } from '../db';
import { validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../types/authenticated-request';


export const createProblem: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { name, difficulty, tags, date_solved, notes } = req.body;
    const userId = req.authUser?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const [newProblem] = await db('problems')
      .insert({
        user_id: userId,
        name,
        difficulty,
        tags,
        date_solved,
        notes
      })
      .returning(['problem_id', 'user_id', 'name', 'difficulty', 'tags', 'date_solved', 'notes', 'created_at']);

    if (!date_solved) {
      res.status(201).json({ message: 'Problem created successfully', problem: newProblem });
      return;
    }

    const reminderIntervals = [3, 7, 15];
    const reminders = reminderIntervals.map((interval) => ({
      problem_id: newProblem.problem_id,
      user_id: userId,
      due_date: new Date(new Date(date_solved).setDate(new Date(date_solved).getDate() + interval)),
      interval
    }));

    await db('reminders').insert(reminders);

    res.status(201).json({
      message: 'Problem created successfully with scheduled reminders',
      problem: newProblem
    });
  } catch (error: unknown) {
    console.error(
      'Create problem error:',
      error instanceof Error ? error.message : error
    );
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProblems: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.authUser?.userId; 

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Extract optional query parameters
    const { difficulty, tags, date_solved } = req.query;
    let query = db('problems').where({ user_id: userId });

    // Apply filters if present
    if (difficulty) {
      query = query.where('difficulty', difficulty as string);
    }
    if (tags) {
      const tagsArray = (tags as string).split(',');
      query = query.whereRaw('tags @> ?', [tagsArray]);
    }
    if (date_solved) {
      query = query.where('date_solved', date_solved as string);
    }

    // Execute query and fetch problems
    const problems = await query.select(
      'problem_id',
      'name',
      'difficulty',
      'tags',
      'date_solved',
      'notes',
      'created_at'
    );

    res.status(200).json({ problems });
  } catch (error: unknown) {
    console.error(
      'Get problems error:',
      error instanceof Error ? error.message : error
    );
    res.status(500).json({ error: 'Internal server error' });
  }
};


export const getProblemById: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.authUser?.userId;
    const { problem_id } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Fetch the problem belonging to the authenticated user
    const problem = await db('problems')
      .where({ problem_id, user_id: userId })
      .first();

    if (!problem) {
      res.status(404).json({ error: 'Problem not found' });
      return;
    }

    res.status(200).json({ problem });
  } catch (error: unknown) {
    console.error(
      'Get problem by ID error:',
      error instanceof Error ? error.message : error
    );
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProblem: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const userId = req.authUser?.userId;
    const { problem_id } = req.params;
    const { name, difficulty, tags, date_solved, notes } = req.body;

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

    const updatedFields: Record<string, any> = {};
    if (name) updatedFields.name = name;
    if (difficulty) updatedFields.difficulty = difficulty;
    if (tags) updatedFields.tags = tags;
    if (date_solved) updatedFields.date_solved = date_solved;
    if (notes) updatedFields.notes = notes;

    const [updatedProblem] = await db('problems')
      .where({ problem_id, user_id: userId })
      .update(updatedFields)
      .returning([
        'problem_id',
        'name',
        'difficulty',
        'tags',
        'date_solved',
        'notes',
        'updated_at'
      ]);

    res.status(200).json({
      message: 'Problem updated successfully',
      problem: updatedProblem
    });
  } catch (error: unknown) {
    console.error(
      'Update problem error:',
      error instanceof Error ? error.message : error
    );
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteProblem: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.authUser?.userId;
    const { problem_id } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Ensure the problem exists and belongs to the authenticated user
    const existingProblem = await db('problems')
      .where({ problem_id, user_id: userId })
      .first();

    if (!existingProblem) {
      res.status(404).json({ error: 'Problem not found' });
      return;
    }

    // Delete associated reminders first to maintain integrity
    await db('reminders').where({ problem_id }).del();

    // Delete the problem
    await db('problems').where({ problem_id }).del();

    res.status(200).json({ message: 'Problem deleted successfully' });
  } catch (error: unknown) {
    console.error(
      'Delete problem error:',
      error instanceof Error ? error.message : error
    );
    res.status(500).json({ error: 'Internal server error' });
  }
};