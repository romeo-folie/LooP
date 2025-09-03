import { randomUUID } from "crypto";
import logger from "../lib/winston-config";
import { AppRequestHandler } from "../types";

const HEADER = "x-request-id";

export const requestId: AppRequestHandler = (req, res, next) => {
  const incoming = req.header(HEADER);
  const id = incoming && incoming.trim() ? incoming.trim() : randomUUID();

  req.requestId = id;
  res.locals.requestId = id;
  req.log = logger.child({ requestId: id });

  next();
};
