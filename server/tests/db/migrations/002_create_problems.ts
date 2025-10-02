import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("problems", (table) => {
    table.increments("problem_id").primary();
    table
      .integer("user_id")
      .notNullable()
      .references("user_id")
      .inTable("users")
      .onDelete("CASCADE");
    table.string("name", 255).notNullable();
    table.enu("difficulty", ["Easy", "Medium", "Hard"]).nullable();
    table.text("tags").nullable();
    table.date("date_solved").nullable();
    table.text("notes").nullable();
    table.text("practice_meta").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("problems");
}
