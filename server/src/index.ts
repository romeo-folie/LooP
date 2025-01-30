import express, { Application } from 'express';
import dotenv from 'dotenv';
import router from './routes';
import { connectDB } from './db';
import httpLogger from './middleware/logger-middleware';

dotenv.config();

const app: Application = express();
const PORT: number = Number(process.env.PORT);

app.use(express.json());
app.use(httpLogger); // Log all HTTP requests

app.use('/api', router);

// Connect to PostgresDB
connectDB();

app.listen(PORT, () => {
  console.info(`🚀 server running on http://[::1]:${PORT}`)
})