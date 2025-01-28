export interface IReminder {
  // Primary key
  reminder_id?: number;

  // Foreign keys
  problem_id: number;
  user_id: number;

  // Fields
  due_date: Date;
  interval: number;

  // Optional status fields
  is_sent?: boolean;
  sent_at?: Date | null;
  is_completed?: boolean;
  completed_at?: Date | null;

  // Timestamps
  created_at?: Date;
  updated_at?: Date;
}