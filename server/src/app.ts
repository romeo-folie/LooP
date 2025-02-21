import express, { Application } from 'express';
import httpLogger from './middleware/logger-middleware';
import router from './routes';
import cors from 'cors';

const app: Application = express();
const corsOptions = { origin: process.env.CLIENT_URL as string }

app.use(express.json());
app.use(httpLogger);
app.use(cors(corsOptions));
app.use('/api', router);

export default app;