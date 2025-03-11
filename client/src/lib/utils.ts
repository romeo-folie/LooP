import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import pino from "pino";

const isProduction = import.meta.env.MODE === "production";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

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


