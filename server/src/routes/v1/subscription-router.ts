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

const router: Router = Router();

router.post(
  "/",
  zodValidate({ body: createSubscriptionSchema }),
  handleCreateSubscription,
);
router.delete(
  "/",
  zodValidate({ body: deleteSubscriptionSchema }),
  handleDeleteSubscription,
);

export default router;
