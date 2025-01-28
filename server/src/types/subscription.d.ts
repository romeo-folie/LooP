export interface ISubscription {
  // Primary key
  subscription_id?: number;

  // Foreign key
  user_id: number;

  // Web push subscription fields
  endpoint: string;
  public_key: string;
  auth: string;

  // Timestamps & status
  created_at?: Date;
  updated_at?: Date;
  is_active?: boolean;
}