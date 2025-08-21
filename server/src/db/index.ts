import pgPromise from "pg-promise";
import dotenv from "dotenv";
import knex from "knex";
import knexConfig from "./knexfile";
import cron from "node-cron";
import reminderJob from "../jobs/reminder-job";

dotenv.config();

const environment = process.env.NODE_ENV as string;

const pgp = pgPromise();
export const postgres = pgp({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const runMigrations = async () => {
  try {
    await knex(knexConfig[environment]!).migrate.latest();
    console.log("✅ Database migrations applied");
  } catch (error) {
    console.error("❌ Error running migrations:", error);
  }
};

export const connectDB = function () {
  // Test Database Connection
  postgres
    .connect()
    .then(async (obj) => {
      obj.done(); // Release connection
      console.log("✅ Connected to PostgreSQL database");
      await runMigrations();
      cron.schedule("* * * * *", reminderJob);
    })
    .catch((error: unknown) => {
      console.error(
        "❌ Database connection error: ",
        error instanceof Error ? error.message : error,
      );
    });
};

// Initialize knex query builder
export const db = knex(knexConfig[environment]!);

if (environment === "development") {
  // Enable SQL query logging
  db.on("query", (queryData) => {
    console.log(`📝 SQL Query: ${queryData.sql}`);
    if (queryData.bindings) {
      console.log(`🔗 Bindings: ${JSON.stringify(queryData.bindings)}`);
    }
  });
}
