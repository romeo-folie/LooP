/* eslint-disable @typescript-eslint/no-empty-object-type */
import { AppRequestHandler } from "../types";
import AppError from "../types/errors";
import { Settings } from "../types/knex-tables";
import {
  getUserPreferences,
  upsertUserPreferences,
} from "../services/preferences.service";

export const handleUpsertPreferences: AppRequestHandler<
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

    const { settings } = req.body ?? {};
    if (!settings || typeof settings !== "object") {
      throw new AppError("BAD_REQUEST", "Valid settings object is required");
    }

    const { settings: saved, created } = await upsertUserPreferences({
      userId,
      settings,
      log: req.log,
    });

    res.status(created ? 201 : 200).json({
      message: created
        ? "Preferences saved successfully"
        : "Preferences updated successfully",
      settings: saved,
    });
  } catch (error) {
    req.log?.error("handleUpsertPreferences:error", {
      userId: req.authUser?.userId ?? "unknown",
      message: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const handleGetPreferences: AppRequestHandler<
  {},
  { settings: Settings }
> = async (req, res, next) => {
  try {
    const userId = req.authUser?.userId;
    if (!userId) {
      req.log?.warn("Unauthorized access attempt to GET /preferences");
      throw new AppError("UNAUTHORIZED");
    }

    const settings = await getUserPreferences({ userId, log: req.log });

    res.status(200).json({ settings });
  } catch (error) {
    req.log?.error("handleGetPreferences:error", {
      userId: req.authUser?.userId ?? "unknown",
      message: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};
