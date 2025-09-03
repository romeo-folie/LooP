/* eslint-disable @typescript-eslint/no-empty-object-type */
import { db } from "../db";
import { AppRequestHandler } from "../types";
import AppError from "../types/errors";
import { Settings } from "../types/knex-tables";

export const upsertPreferences: AppRequestHandler<
  {},
  { message: string; settings: Settings },
  { settings: Settings }
> = async (req, res, next) => {
  try {
    const userId = req.authUser?.userId;
    if (!userId) {
      req.log?.warn("Unauthorized access attempt to PUT /preferences");
      throw new AppError("UNAUTHORIZED");
    }

    const { settings } = req.body;
    const now = new Date();

    // Check if a preferences row already exists for this user
    const existing = await db("user_preferences")
      .where({ user_id: userId })
      .first();

    if (existing) {
      // Update the existing row
      const [updated] = await db("user_preferences")
        .where({ user_id: userId })
        .update({
          settings,
          updated_at: now,
        })
        .returning(["settings"]);

      if (!updated) {
        req.log?.error(`Failed to update settings for user ID ${userId}`);
        throw new Error("Failed to update settings");
      }

      res.status(200).json({
        message: "Preferences updated successfully",
        settings: updated.settings,
      });
    } else {
      // Insert a new row
      const [inserted] = await db("user_preferences")
        .insert({
          user_id: userId,
          settings,
          created_at: now,
          updated_at: now,
        })
        .returning(["settings"]);

      if (!inserted) {
        req.log?.error(`Failed to save settings for user ID ${userId}`);
        throw new Error("Failed to save settings");
      }

      res.status(201).json({
        message: "Preferences saved successfully",
        settings: inserted.settings,
      });
    }
  } catch (error: unknown) {
    req.log?.error(`Error upserting preferences ${error}`);
    next(error);
  }
};

export const getPreferences: AppRequestHandler<
  {},
  { settings: Settings }
> = async (req, res, next) => {
  try {
    const userId = req.authUser?.userId;
    if (!userId) {
      req.log?.warn("Unauthorized access attempt to GET /preferences");
      throw new AppError("UNAUTHORIZED");
    }

    const existing = await db("user_preferences")
      .where({ user_id: userId })
      .first();

    if (existing) {
      res.status(200).json({ settings: existing.settings });
    } else {
      res.status(200).json({ settings: {} });
    }
  } catch (error: unknown) {
    req.log?.error(`Error fetching preferences ${error}`);
    next(error);
  }
};
