export interface IUser {
  // Primary key
  user_id?: number;

  // Fields
  name: string;
  email: string;
  password: string;

  // Timestamps & status
  created_at?: Date;
  updated_at?: Date;
  is_active?: boolean;
}