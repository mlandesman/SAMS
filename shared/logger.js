// shared/logger.js
// Centralized logging utility with configurable log levels
// Allows debug logs to be enabled/disabled via LOG_LEVEL environment variable

const LEVELS = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};

const CURRENT_LEVEL =
  LEVELS[process.env.LOG_LEVEL] ?? LEVELS.INFO;

function shouldLog(level) {
  return level >= CURRENT_LEVEL;
}

export function logDebug(message, meta) {
  if (!shouldLog(LEVELS.DEBUG)) return;
  console.debug(message, meta ?? "");
}

export function logInfo(message, meta) {
  if (!shouldLog(LEVELS.INFO)) return;
  console.log(message, meta ?? "");
}

export function logWarn(message, meta) {
  if (!shouldLog(LEVELS.WARN)) return;
  console.warn(message, meta ?? "");
}

export function logError(message, meta) {
  if (!shouldLog(LEVELS.ERROR)) return;
  console.error(message, meta ?? "");
}
