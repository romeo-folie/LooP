import request from 'supertest';
import app from '../src/app';
import { db } from '../src/db';
import { generateExpiredRefreshToken, generateRefreshToken } from '../src/utils/jwt';

process.env.NODE_ENV = 'test';

beforeAll(async () => {
  await db.migrate.latest();
  // await db.seed.run();
});

afterAll(async () => {
  await db.destroy();
});

describe('authentication tests', () => {
  const validEmail = "testuser@example.com"
  const validPassword = "testPassw0rD%"

  describe('user registration', () => {
    it('should return 400 with errors if password is invalid', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', email: validEmail, password: 'testpassword' });
  
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Password must contain at least one uppercase letter', path: 'password' }),
          expect.objectContaining({ msg: 'Password must contain at least one number', path: 'password' }),
          expect.objectContaining({ msg: 'Password must contain at least one symbol', path: 'password' }),
        ])
      );
    });

    it('should return 400 if email is invalid', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', email: 'testuserexample.com', password: 'testPassw0rD%' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Invalid email address' })
        ])
      );
    });

    it('should successfully create a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', email: validEmail, password: 'testPassw0rD%' });
      
      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User registered successfully');
    });

    it('should return a 400 if email is already in use', async () => {
      const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: validEmail, password: 'testPassw0rD%' });
    
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Email already in use');
    });

  });


  describe('user login', () => {
    it('should return 401 for wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'testuser@example.com', password: 'testPassw0rd!' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should return 401 if user does not exist', async () => { 
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'testuser@wrongmail.com', password: 'testPassw0rd!' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should return 400 for missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: '', });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Invalid email address' }),
          expect.objectContaining({ msg: 'Password is required' }),
        ])
      );
    }); 

    it('should log user in if they exist and the credentials are valid', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'testuser@example.com', password: 'testPassw0rD%' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
    });
  });

  describe('token refresh', () => {
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
      expect(res.body).toHaveProperty("error", "Invalid or expired refresh token");
    });

    it("Should return 403 when refresh token is tampered or invalid", async () => {
      const res = await request(app)
        .post("/api/auth/refresh-token")
        .set("Cookie", `refresh_token=${invalidRefreshToken}`)
        .send();
  
      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("error", "Invalid or expired refresh token");
    });

    it("Should return 400 when no refresh token is provided", async () => {
      const res = await request(app)
        .post("/api/auth/refresh-token")
        .send();
  
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
      const refreshTokenCookie = cookieArray.find((cookie: string) => cookie.startsWith("refresh_token"));

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

});