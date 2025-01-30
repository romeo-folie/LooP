import morgan from 'morgan';
import logger from '../logging/winston-config';

// Create a Morgan stream that logs to Winston
const stream = {
  write: (message: string) => logger.debug(message.trim())
};

// Define Morgan middleware
const httpLogger = morgan(':method :url :status :res[content-length] - :response-time ms', { stream });

export default httpLogger;
