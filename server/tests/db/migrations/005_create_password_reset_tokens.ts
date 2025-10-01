import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("password_reset_tokens", (table) => {
    table.increments("id").primary();
    table
      .integer("user_id")
      .notNullable()
      .references("user_id")
      .inTable("users")
      .onDelete("CASCADE");
    table.string("otp_hash", 255).notNullable();
    table.timestamp("expires_at").notNullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("password_reset_tokens");
}
