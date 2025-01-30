import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('reminders', (table) => {
    table.increments('reminder_id').primary();
    table
      .integer('problem_id')
      .notNullable()
      .references('problem_id')
      .inTable('problems')
      .onDelete('CASCADE'); // Optionally cascade if a problem is deleted

    table
      .integer('user_id')
      .notNullable()
      .references('user_id')
      .inTable('users')
      .onDelete('CASCADE'); // Optionally cascade if a user is deleted

    table.timestamp('due_datetime').notNullable();

    // Optional columns to track sending and completion status
    table.boolean('is_sent').defaultTo(false);
    table.timestamp('sent_at');

    table.boolean('is_completed').defaultTo(false);
    table.timestamp('completed_at');

    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('reminders');
}
