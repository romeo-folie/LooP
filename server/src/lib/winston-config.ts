import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

const isTest = process.env.NODE_ENV === "test" || process.env.CI === "true";
const defaultLevel = process.env.LOG_LEVEL || (isTest ? "error" : "info");

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  // ensures errors get a `.stack` property on info if an Error object was logged
  winston.format.errors({ stack: true }),
  // put everything except level/message/timestamp into `metadata`
  winston.format.metadata({
    fillExcept: ["message", "level", "timestamp", "stack"],
  }),
  winston.format.json(),
);

// Console transport: pretty-print JSON-like output and include metadata & stack
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp(),
  winston.format.errors({ stack: true }), // capture stack on info.stack
  winston.format.metadata({
    fillExcept: ["message", "level", "timestamp", "stack"],
  }),
  winston.format.printf((info) => {
    const ts = info.timestamp;
    const lvl = info.level;
    const msg = info.message;
    // if you add requestId as top-level on info in the logger call, it will appear on info.requestId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestId = (info as any).requestId
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        `[${(info as any).requestId}] `
      : "";
    // merge stack into metadata for printing (if present)
    const meta: Record<string, unknown> = { ...(info.metadata || {}) };
    if (info.stack) meta.stack = info.stack;

    const metaStr = Object.keys(meta).length
      ? ` | metadata=${JSON.stringify(meta)}`
      : "";
    return `${requestId}${ts} ${lvl}: ${msg}${metaStr}`;
  }),
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    level: isTest ? "error" : "debug", // console verbosity during dev, quiet in tests
    format: consoleFormat,
  }),
  new DailyRotateFile({
    filename: "logs/loop-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    maxSize: "20m",
    maxFiles: "14d",
    level: "info",
    format: jsonFormat, // structured JSON for files
  }),
];

// Create Winston logger instance
const logger = winston.createLogger({
  level: defaultLevel,
  transports,
  // ensure unhandled exceptions are written (optional)
  exceptionHandlers: [
    new DailyRotateFile({
      filename: "logs/exceptions-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
    }),
  ],
});

export default logger;
