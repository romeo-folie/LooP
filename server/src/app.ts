import express, { Application } from 'express';
import httpLogger from './middleware/logger-middleware';
import router from './routes';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import webpush from 'web-push'

const app: Application = express();
const corsOptions = { origin: process.env.CLIENT_URL as string, credentials: true, allowedHeaders: "Content-Type, Authorization, X-CSRF-TOKEN, X-SYNC-ORIGIN" }

webpush.setVapidDetails(
  process.env.CONTACT_EMAIL as string, 
  process.env.VAPID_PUBLIC_KEY as string,
  process.env.VAPID_PRIVATE_KEY as string
);

app.set('trust proxy', true);
app.use(cookieParser());
app.use(express.json());
app.use(httpLogger);
app.use(cors(corsOptions));
app.use('/api', router);

export default app;