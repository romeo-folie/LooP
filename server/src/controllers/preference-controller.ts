import { RequestHandler } from "express";
import { db } from "../db";
import logger from "../config/winston-config";
import { AuthenticatedRequest } from "../types/authenticated-request";

export const upsertPreferences: RequestHandler = async (
  req: AuthenticatedRequest,
  res,
) => {
  try {
    const userId = req.authUser?.userId;
    if (!userId) {
      logger.warn("Unauthorized access attempt to PUT /preferences");
      res.status(401).json({ error: "Unauthorized" });
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

      res.status(201).json({
        message: "Preferences created successfully",
        settings: inserted.settings,
      });
    }
  } catch (error: unknown) {
    logger.error(`Error upserting preferences ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getPreferences: RequestHandler = async (
  req: AuthenticatedRequest,
  res,
) => {
  try {
    const userId = req.authUser?.userId;
    if (!userId) {
      logger.warn("Unauthorized access attempt to GET /preferences");
      res.status(401).json({ error: "Unauthorized" });
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
    logger.error(`Error fetching preferences ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
};
