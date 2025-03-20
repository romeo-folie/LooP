import pino from "pino";

const isProduction = import.meta.env.MODE === "production";

export const logger = pino({
  level: isProduction ? "info" : "debug", // Log levels: trace, debug, info, warn, error, fatal
  browser: {
    asObject: true,
    serialize: isProduction,
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});
