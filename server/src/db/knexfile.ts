// Update with your config settings.
import path from 'path';
import { Knex } from 'knex';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env')});

const BASE_CONFIG: Knex.Config = {
  client: 'pg',
  migrations: {
    directory: path.resolve(__dirname, '../migrations'),
    extension: 'ts',
  },
  seeds: {
    directory: path.resolve(__dirname, '../seeds'),
  },
};

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
const config: {[key: string]: Knex.Config } = {

  development: {
    ...BASE_CONFIG,
    connection: {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
  },

  test: {
    client: 'sqlite3',
    connection: {
      filename: ':memory:',
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.resolve(__dirname, '../migrations'),
      extension: 'ts',
    },
  },

  // production: {
  //   ...BASE_CONFIG,
  //   connection: {
  //     database: 'my_db',
  //     user:     'username',
  //     password: 'password'
  //   },
  // }

};

export default config;
