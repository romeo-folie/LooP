import path from "path";
import { Knex } from "knex";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const BASE_CONFIG: Knex.Config = {
  client: "pg",
  migrations: {
    directory: path.resolve(__dirname, "./migrations"),
    extension: "ts",
  },
  seeds: {
    directory: path.resolve(__dirname, "./seeds"),
  },
};

const config: { [key: string]: Knex.Config } = {
  development: {
    ...BASE_CONFIG,
    connection: {
      host: process.env.DB_HOST as string,
      user: process.env.DB_USER as string,
      password: process.env.DB_PASSWORD as string,
      database: process.env.DB_NAME as string,
    },
  },

  test: {
    client: "sqlite3",
    connection: {
      filename: ":memory:",
    },
    useNullAsDefault: true,
    pool: {
      min: 1,
      max: 1,
    },
    migrations: {
      directory: path.resolve(__dirname, "../tests/db/migrations"),
      extension: "ts",
    },
    // seeds: {
    //   directory: path.resolve(__dirname, "../tests/db/seeds"),
    // },
  },

  production: {
    ...BASE_CONFIG,
    connection: {
      host: process.env.DB_HOST as string,
      user: process.env.DB_USER as string,
      password: process.env.DB_PASSWORD as string,
      database: process.env.DB_NAME as string,
    },
  },
};

export default config;
