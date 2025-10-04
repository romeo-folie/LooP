import { Router, Request, Response } from "express";
import problemRouter from "./problem-router";
import authRouter from "./auth-router";
import reminderRouter from "./reminder-router";
import subscriptionRouter from "./subscription-router";
import preferenceRouter from "./preference-router";
import { authenticateJWT } from "../../middleware/auth-middleware";

const router: Router = Router();

router.get("/health", (_req: Request, res: Response) => {
  res
    .status(200)
    .send({ message: "loop server ok", timestamp: new Date().toISOString() });
});
router.get("/version", (_req, res) => {
  res.json({ api: "LooP", version: "v1" });
});
router.use("/auth", authRouter);
router.use("/problems", authenticateJWT, problemRouter);
router.use("/reminders", authenticateJWT, reminderRouter);
router.use("/subscriptions", authenticateJWT, subscriptionRouter);
router.use("/preferences", authenticateJWT, preferenceRouter);

export default router;
