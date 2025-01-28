import { Request, Response, RequestHandler } from 'express';
import { validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import dotenv from 'dotenv';
import { AuthenticatedRequest } from '../types/authenticated-request';
dotenv.config();

export const register: RequestHandler = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return 
  }

  try {
    const { name, email, password } = req.body;

    const existingUser = await db('users').where({ email }).first();
    if (existingUser) {
      res.status(400).json({ message: 'Email already in use' });
      return
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [newUser] = await db('users')
      .insert({
        name,
        email,
        password: hashedPassword
      })
      .returning(['user_id', 'name', 'email', 'created_at']);

    res.status(201).json({
      message: 'User registered successfully',
      user: newUser
    });
  } catch (error: unknown) {
    console.error('Register error:', error instanceof Error ? error.message : error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export const login: RequestHandler = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  try {
    const { email, password } = req.body;

    const existingUser = await db('users').where({ email }).first();
    if (!existingUser) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const isMatch = await bcrypt.compare(password, existingUser.password);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      {
        userId: existingUser.user_id,
        email: existingUser.email
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '3h' }
    );

    const refreshToken = jwt.sign(
      {
        userId: existingUser.user_id,
        email: existingUser.email
      },
      process.env.REFRESH_SECRET as string,
      { expiresIn: '7d' } 
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      refreshToken
    });
  } catch (error: unknown) {
    console.error(
      'Login error:',
      error instanceof Error ? error.message : error
    );
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const refreshToken: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token is required' });
      return;
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET as string) as { userId: string; email: string };
    } catch (err) {
      res.status(403).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    // Generate a new access token
    const newAccessToken = jwt.sign(
      { userId: decoded.userId, email: decoded.email },
      process.env.JWT_SECRET as string,
      { expiresIn: '3h' }
    );

    res.status(200).json({
      message: 'Token refreshed successfully',
      token: newAccessToken
    });
  } catch (error: unknown) {
    console.error(
      'Refresh token error:',
      error instanceof Error ? error.message : error
    );
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProfile: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {

    if (!req.authUser?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return
    }

    const { userId } = req.authUser;

    const user = await db('users')
      .select('user_id', 'name', 'email', 'created_at')
      .where({ user_id: userId })
      .first();

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({ user });
  } catch (error: unknown) {
    console.error(
      'Get profile error:',
      error instanceof Error ? error.message : error
    );
    res.status(500).json({ error: 'Internal server error' });
  }
};