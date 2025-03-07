import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // 1. Clear existing entries
  await knex('problems').del();

  // 2. Insert sample data
  await knex('problems').insert([
    {
      user_id: 1,
      name: 'Two Sum',
      difficulty: 'Easy', 
      tags: ['array', 'hashmap'],
      date_solved: '2025-01-20',
      notes: 'Used a hashmap approach for O(n) time complexity.'
    },
    {
      user_id: 1,
      name: 'Longest Palindromic Substring',
      difficulty: 'Medium',
      tags: ['string', 'dp'],
      date_solved: '2025-01-22',
      notes: 'Explored dynamic programming and expand-from-center approaches.'
    },
    {
      user_id: 1,
      name: 'Binary Tree Inorder Traversal',
      difficulty: 'Easy',
      tags: ['tree', 'stack'],
      date_solved: '2025-01-25',
      notes: 'Practiced both recursive and iterative solutions.'
    },
    {
      user_id: 1,
      name: 'Trapping Rain Water',
      difficulty: 'Hard',
      tags: ['array', 'two-pointer'],
      date_solved: '2025-02-01',
      notes: 'Utilized two-pointer technique to achieve O(n) time complexity.'
    },
    {
      user_id: 1,
      name: '3Sum',
      difficulty: 'Medium',
      tags: ['array', 'two-pointer'],
      date_solved: '2025-03-10',
      notes: 'Sort + two-pointer approach. Took care of duplicate elements.'
    }
  ]);
}
