/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Knex } from "knex";

export interface IUserRow {
  user_id: number;
  name: string;
  email: string;
  password: string;
  provider?: string | null;
  provider_id?: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
export interface IProblemRow {
  problem_id: number;
  user_id: number;
  name: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string | string[] | null;
  date_solved: Date;
  notes?: string | null;
  created_at: Date;
  updated_at: Date;
  practice_meta?: Record<string, any>;
}
export interface IReminderRow {
  reminder_id: number;
  problem_id: number;
  user_id: number;
  due_datetime: Date | string;
  is_sent: boolean;
  sent_at?: Date | null;
  is_completed?: boolean;
  completed_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export type Settings = {
  autoReminders?: boolean;
};
export interface IUserPreferencesRow {
  preference_id: number;
  user_id: number;
  settings: Settings | string;
  created_at: Date;
  updated_at: Date;
}
export interface IPasswordResetTokenRow {
  id: number;
  user_id: number;
  otp_hash: string;
  expires_at: Date | string;
  created_at: Date;
}

export interface ISubscriptionRow {
  subscription_id: number;
  user_id: number;
  endpoint: string;
  public_key: string;
  auth: string;
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
}

declare module "knex/types/tables" {
  interface Tables {
    users: IUserRow;
    problems: IProblemRow;
    reminders: IReminderRow;
    user_preferences: IUserPreferencesRow;
    password_reset_tokens: IPasswordResetTokensRow;
    subscriptions: ISubscriptionRow;
  }
}
