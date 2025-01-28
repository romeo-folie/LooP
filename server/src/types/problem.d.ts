export interface IProblem {
  // Primary key
  problem_id?: number;

  // Foreign key
  user_id: number;

  // Fields
  name: string;
  difficulty: string;
  tags?: string[]; // TEXT[] column in PostgreSQL
  date_solved?: Date;
  notes?: string;

  // Timestamps
  created_at?: Date;
  updated_at?: Date;
}