import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("problems", (table) => {
    table.jsonb("practice_meta").defaultTo(JSON.stringify({})).notNullable()
      .comment(`spaced‑repetition metadata:
        {
          "attempt_count": number,
          "last_attempted_at": ISO8601 string,
          "ease_factor": number,
          "interval": number,
          "next_due_at": ISO8601 string,
          "quality_score": number
        }`);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("problems", (table) => {
    table.dropColumn("practice_meta");
  });
}
