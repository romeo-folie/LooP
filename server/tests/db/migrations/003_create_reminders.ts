import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable("reminders", (table) => {
    table.increments("reminder_id").primary();
    table
      .integer("problem_id")
      .notNullable()
      .references("problem_id")
      .inTable("problems")
      .onDelete("CASCADE");

    table
      .integer("user_id")
      .notNullable()
      .references("user_id")
      .inTable("users")
      .onDelete("CASCADE");

    table.timestamp("due_datetime").notNullable();
    table.boolean("is_sent").notNullable().defaultTo(false);
    table.timestamp("sent_at").nullable();
    table.boolean("is_completed").notNullable().defaultTo(false);
    table.timestamp("completed_at").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists("reminders");
}
