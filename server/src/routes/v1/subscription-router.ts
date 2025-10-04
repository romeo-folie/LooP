import { Router } from "express";
import {
  handleCreateSubscription,
  handleDeleteSubscription,
} from "../../controllers/subscription-controller";
import { zodValidate } from "../../middleware/validate-request";
import {
  createSubscriptionSchema,
  deleteSubscriptionSchema,
} from "../../middleware/validators";
import { verifyCsrfToken } from "../../middleware/verify-csrf-token";
import { limiter } from "../../middleware/rate-limiter";

const router: Router = Router();

router.post(
  "/",
  limiter({ cost: 2 }),
  verifyCsrfToken,
  zodValidate({ body: createSubscriptionSchema }),
  handleCreateSubscription,
);
router.delete(
  "/",
  limiter({ cost: 3 }),
  verifyCsrfToken,
  zodValidate({ body: deleteSubscriptionSchema }),
  handleDeleteSubscription,
);

export default router;
