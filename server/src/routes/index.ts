import { Router, Request, Response } from "express";
import problemRouter from "./problem-router";
import authRouter from "./auth-router";
import reminderRouter from "./reminder-router";
import subscriptionRouter from "./subscription-router";

const router: Router = Router();

router.get("/health", (req: Request, res: Response) => {
  res
    .status(200)
    .send({ message: "loop server ok", timestamp: new Date().toISOString() });
});

router.use("/auth", authRouter);
router.use("/problems", problemRouter);
router.use("/reminders", reminderRouter);
router.use("/subscriptions", subscriptionRouter);

export default router;
