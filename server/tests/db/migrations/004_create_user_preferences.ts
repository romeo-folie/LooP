import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable("user_preferences", (table) => {
    table.increments("id").primary();
    table
      .integer("user_id")
      .notNullable()
      .references("user_id")
      .inTable("users")
      .onDelete("CASCADE");

    // Store settings as JSON text in test DB
    table.text("settings").nullable();

    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists("user_preferences");
}
