/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Request, Response, NextFunction } from "express";
import logger from "../config/winston-config";
import { ZodType, ZodError } from "zod";

// export const validateRequest = (
//   req: Request,
//   res: Response,
//   next: NextFunction,
// ) => {
//   const errors = validationResult(req);
//   if (!errors.isEmpty()) {
//     logger.warn(
//       `${req.method} request to ${req.url} failed due to validation errors: ${JSON.stringify(errors.array())}`,
//     );
//     res.status(400).json({ errors: errors.array() });
//     return;
//   }
//   next();
// };

// export function validateRequest<S extends z.ZodTypeAny>(schema: S) {
//   return (req: Request, res: Response, next: NextFunction) => {
//     const parsed = schema.safeParse(req.body);
//     if (!parsed.success) {
// logger.warn(
//   `${req.method} request to ${req.url} failed due to validation errors: ${JSON.stringify(parsed.error.flatten)}`,
// );
//       return res.status(400).json({ errors: parsed.error.flatten });
//     }
//     req.body = parsed.data as z.infer<S>;
//     next();
//   };
// }

type Schemas = {
  body?: ZodType<any>;
  query?: ZodType<any>;
  params?: ZodType<any>;
};

export function zodValidate(schemas: Schemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        const parsed = schemas.body.parse(req.body);
        req.body = parsed;
      }
      if (schemas.query) {
        const parsed = schemas.query.parse(req.query);
        req.query = parsed;
      }
      if (schemas.params) {
        const parsed = schemas.params.parse(req.params);
        req.params = parsed;
      }
      next();
    } catch (err) {
      logger.warn(
        `${req.method} request to ${req.url} failed due to validation errors`,
      );
      if (err instanceof ZodError) {
        res.status(400).json({
          error: "Validation failed",
          issues: err.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
            code: i.code,
          })),
        });
        return;
      }
      next(err);
    }
  };
}
