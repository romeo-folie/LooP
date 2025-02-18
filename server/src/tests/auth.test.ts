import request from 'supertest';
import app from '../app';
import { db } from '../db';

process.env.NODE_ENV = 'test';

beforeAll(async () => {
  await db.migrate.latest();
  // await db.seed.run();
});

afterAll(async () => {
  await db.destroy();
});

describe('authentication tests', () => {

  describe('user registration', () => {
    it('should return 400 with errors if password is invalid', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', email: 'testuser@example.com', password: 'testpassword' });
  
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
        .send({ name: 'Test User', email: 'testuser@example.com', password: 'testPassw0rD%' });
      
      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User registered successfully');
    });

    it('should return a 400 if email is already in use', async () => {
      const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: 'testuser@example.com', password: 'testPassw0rD%' });
    
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

});