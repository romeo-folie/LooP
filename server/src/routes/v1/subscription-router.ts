import { Router } from "express";
import { authenticateJWT } from "../../middleware/auth-middleware";
import {
  handleCreateSubscription,
  handleDeleteSubscription,
} from "../../controllers/subscription-controller";
import { verifyCsrfToken } from "../../middleware/verify-csrf-token";
import { zodValidate } from "../../middleware/validate-request";
import {
  createSubscriptionSchema,
  deleteSubscriptionSchema,
} from "../../middleware/validators";

const router: Router = Router();

router.post(
  "/",
  verifyCsrfToken,
  authenticateJWT,
  zodValidate({ body: createSubscriptionSchema }),
  handleCreateSubscription,
);
router.delete(
  "/",
  verifyCsrfToken,
  authenticateJWT,
  zodValidate({ body: deleteSubscriptionSchema }),
  handleDeleteSubscription,
);

export default router;
