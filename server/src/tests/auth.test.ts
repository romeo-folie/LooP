import request from 'supertest';
import app from '../app';
import knex, { Knex } from 'knex';
import knexConfig from '../db/knexfile';

let db: Knex;

beforeAll(async () => {
  db = knex(knexConfig.test);
  await db.migrate.latest();
  // await db.seed.run();
});

afterAll(async () => {
  await db.destroy();
});

describe('authentication tests', () => {
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
});