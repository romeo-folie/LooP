import express, { Application } from 'express';
import httpLogger from './middleware/logger-middleware';
import router from './routes';

const app: Application = express();

app.use(express.json());
app.use(httpLogger); // Log all HTTP requests

app.use('/api', router);

export default app;