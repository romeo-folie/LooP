import express, { Application } from "express";
import httpLogger from "./middleware/logger-middleware";
import v1Router from "./routes/v1";
import cors from "cors";
import cookieParser from "cookie-parser";
import webpush from "web-push";
import helmet from "helmet";
import { errorHandler } from "./middleware/error-middleware";
import AppError from "./types/errors";
import { requestId } from "./middleware/request-id";

const app: Application = express();
const corsOptions = {
  origin: process.env.CLIENT_URL as string,
  credentials: true,
  allowedHeaders: "Content-Type, Authorization, X-CSRF-TOKEN, X-SYNC-ORIGIN",
};

webpush.setVapidDetails(
  process.env.CONTACT_EMAIL as string,
  process.env.VAPID_PUBLIC_KEY as string,
  process.env.VAPID_PRIVATE_KEY as string,
);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        "img-src": ["'self'", "data:"],
        "font-src": ["'self'", "data:"],
        "connect-src": ["'self'", `${process.env.SERVER_URL}`],
        "form-action": ["'self'", `${process.env.SERVER_URL}`],
        "base-uri": ["'none'"],
        "object-src": ["'none'"],
        "frame-ancestors": ["'none'"],
      },
      reportOnly: process.env.NODE_ENV !== "production",
    },
  }),
);

app.set("trust proxy", true);
app.use(requestId);
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(httpLogger);

app.use("/api/v1", v1Router);
app.use("/api", v1Router);

app.use((_req, _res, next) => {
  next(new AppError("NOT_FOUND", "Route not found"));
});

app.use(errorHandler);

export default app;
