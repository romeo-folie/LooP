import { Request, Response, RequestHandler } from 'express';
import { validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import dotenv from 'dotenv';
import { db } from '../db';
import { AuthenticatedRequest } from '../types/authenticated-request';
import logger from '../logging/winston-config';
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
      
    logger.info(`New user registered: ${email}`);

    res.status(201).json({
      message: 'User registered successfully',
      user: newUser
    });
  } catch (error: unknown) {
    logger.error(`Register Error: ${error instanceof Error ? error.message : error}`)
    res.status(500).json({ message: 'Internal server error' });
  }
}

export const login: RequestHandler = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`Login failed: Invalid input from ${req.ip}`);
    res.status(400).json({ errors: errors.array() });
    return;
  }

  try {
    const { email, password } = req.body;

    const existingUser = await db('users').where({ email }).first();
    if (!existingUser) {
      logger.warn(`Login failed: User not found - ${email}`);
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
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      {
        userId: existingUser.user_id,
        email: existingUser.email
      },
      process.env.REFRESH_SECRET as string,
      { expiresIn: '7d' } 
    );

    logger.info(`Login successful for ${email} from IP: ${req.ip}`);

    res.status(200).json({
      message: 'Login successful',
      token,
      refreshToken
    });
  } catch (error: unknown) {
    logger.error(`Login error for ${req.body?.email || 'unknown user'}: ${error instanceof Error ? error.message : error}`);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const refreshToken: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    logger.info(`Refresh token request received from IP: ${req.ip}`);

    if (!refreshToken) {
      logger.warn(`Refresh token request missing token from IP: ${req.ip}`);
      res.status(400).json({ error: 'Refresh token is required' });
      return;
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET as string) as { userId: string; email: string };
    } catch (err) {
      logger.warn(`Invalid or expired refresh token from IP: ${req.ip}`);
      res.status(403).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    // Find the user
    const user = await db('users').where({ email: decoded.email }).first();
    if (!user) {
      logger.warn(`Refresh token failed: User not found - User ID: ${decoded.userId}`);
      res.status(403).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    // Generate a new access token
    const newAccessToken = jwt.sign(
      { userId: decoded.userId, email: decoded.email },
      process.env.JWT_SECRET as string,
      { expiresIn: '1h' }
    );

    logger.info(`Access token refreshed successfully for User ID: ${decoded.userId} from IP: ${req.ip}`);

    res.status(200).json({
      message: 'Token refreshed successfully',
      token: newAccessToken
    });
  } catch (error: unknown) {
    logger.error(`Refresh token error from IP: ${req.ip} - ${error instanceof Error ? error.message : error}`);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProfile: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.info(`Profile fetch request received for User ID: ${req.authUser?.userId} from IP: ${req.ip}`);

    if (!req.authUser?.userId) {
      logger.warn(`Unauthorized profile access attempt from IP: ${req.ip}`);
      res.status(401).json({ error: 'Unauthorized' });
      return
    }

    const { userId } = req.authUser;

    const user = await db('users')
      .select('user_id', 'name', 'email', 'created_at')
      .where({ user_id: userId })
      .first();

    if (!user) {
      logger.warn(`Profile fetch failed: User not found - User ID: ${userId}`);
      res.status(404).json({ error: 'User not found' });
      return;
    }

    logger.info(`Profile retrieved successfully for User ID: ${userId} from IP: ${req.ip}`);

    res.status(200).json({ user });
  } catch (error: unknown) {
    logger.error(`Profile fetch error for User ID: ${req.authUser?.userId || 'unknown'}: ${error instanceof Error ? error.message : error}`);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUserIdentity: RequestHandler = async (req: Request, res: Response) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = 'http://localhost:5999/auth/github/callback';
  const scope = 'read:user user:email';

  // GitHub OAuth authorize endpoint
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;

  logger.info('Redirecting to GitHub OAuth', { clientId });
  res.redirect(githubAuthUrl);
};

export const getAccessToken: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { code } = req.query;

    if (!code) {
      logger.warn('No code returned from GitHub');
      res.status(400).json({ error: 'Missing code parameter' });
      return
    }

    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
      },
      {
        headers: { Accept: 'application/json' }
      }
    );

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      logger.error('No access token received from GitHub');
      res.status(500).json({ error: 'Failed to obtain access token' });
      return
    }

    // Fetch user profile from GitHub
    const userProfileResp = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `token ${accessToken}` }
    });
    const githubUser = userProfileResp.data; 
    // Example: { id, login, name, avatar_url, ... }

    // Fetch user’s email(s)
    const emailsResp = await axios.get('https://api.github.com/user/emails', {
      headers: { Authorization: `token ${accessToken}` }
    });
    const emails = emailsResp.data;
    const primaryEmailObj = emails.find((obj: any) => obj.primary) || emails[0];
    const userEmail = primaryEmailObj ? primaryEmailObj.email : null;

    // Check if user exists
    let existingUser = await db('users').where({ email: userEmail }).first();

    let userId: number;
    if (existingUser) {
      // Possibly update provider fields if user was local
      userId = existingUser.user_id;
      if (!existingUser.provider || existingUser.provider === 'local') {
        await db('users')
          .where({ user_id: userId })
          .update({
            provider: 'github',
            provider_id: String(githubUser.id),
            updated_at: new Date()
          });
        logger.info(`Updated existing user with GitHub provider info: ${userId}`);
      }
      logger.info(`Existing user logged in via GitHub: ${userEmail}`);
    } else {
      // Create a new user
      const displayName = githubUser.name || githubUser.login || 'GitHub User';
      const [newUser] = await db('users')
        .insert({
          name: displayName,
          email: userEmail || `user-${githubUser.id}@github.local`,
          password: '', // no local password needed for OAuth
          provider: 'github',
          provider_id: String(githubUser.id),
          created_at: new Date()
        })
        .returning(['user_id']);
      userId = newUser.user_id;
      logger.info(`New user created via GitHub: ${userEmail}`);
    }

    // Generate JWT
    const token = jwt.sign(
      { userId, email: userEmail },
      process.env.JWT_SECRET as string,
      { expiresIn: '1h' }
    );

    // Set token in HTTP-only cookie
    // res.cookie('access_token', token, {
    //   httpOnly: true,
    //   secure: false, // set secure: true in prod w/ HTTPS
    //   sameSite: 'strict'
    // });

    // Redirect or respond
    res.json({  message: 'OAuth success', token })
  } catch (error) {
    logger.error('GitHub OAuth Callback Error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}