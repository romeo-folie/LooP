import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('problems', (table) => {
    table.increments('problem_id').primary();
    table
      .integer('user_id')
      .notNullable()
      .references('user_id')
      .inTable('users')
      .onDelete('CASCADE'); // optional cascade on user deletion

    table.string('name', 255).notNullable();
    table.string('difficulty', 50).notNullable();

    table.specificType('tags', 'text[]');

    table.date('date_solved').notNullable();
    table.text('notes');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('problems');
}
