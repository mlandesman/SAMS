// shared/logger.js
// Centralized logging utility with configurable log levels
// Allows debug logs to be enabled/disabled via LOG_LEVEL environment variable
// Supports optional error sink for Firestore persistence (registered at startup)
// NOTE: When copied to functions/shared/, change import path to '../backend/services/DateService.js'

import { getNow } from '../backend/services/DateService.js';

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

let errorSink = null;

/**
 * Register an async callback to receive error data when logError is called.
 * Fire-and-forget: never awaited, never blocks the caller.
 * @param {Function} callback - Async function receiving { message, meta, timestamp }
 */
export function registerErrorSink(callback) {
  errorSink = callback;
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

  // Fire-and-forget to registered sink (never await, never block)
  if (errorSink) {
    try {
      errorSink({ message: String(message), meta, timestamp: getNow() });
    } catch (sinkError) {
      console.error('[ErrorSink] Failed to write to sink:', sinkError.message);
    }
  }
}
