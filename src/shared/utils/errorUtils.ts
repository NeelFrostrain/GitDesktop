import { AppError } from '../../types/git';

/**
 * Safely extracts a readable error message from any caught error value (Error, AppError, string, object).
 *
 * @param error - The caught error object or value.
 * @param fallbackMessage - Optional fallback string if no message can be extracted.
 * @returns A clean string message.
 */
export function getErrorMessage(error: unknown, fallbackMessage = 'An unexpected error occurred'): string {
  if (!error) {
    return fallbackMessage;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object') {
    const errorObj = error as Record<string, unknown>;
    if (typeof errorObj.message === 'string' && errorObj.message.trim().length > 0) {
      return errorObj.message;
    }
    if (typeof errorObj.error === 'string' && errorObj.error.trim().length > 0) {
      return errorObj.error;
    }
  }

  try {
    return String(error);
  } catch {
    return fallbackMessage;
  }
}

/**
 * Extracts a human-friendly error message from API error payloads, including embedded JSON.
 */
export function parseApiError(error: unknown, fallbackMessage = 'An unexpected error occurred'): string {
  const raw = getErrorMessage(error, fallbackMessage);

  // Try to find JSON inside the raw message
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.errors) && parsed.errors.length > 0 && parsed.errors[0].message) {
        return parsed.errors[0].message;
      }
      if (typeof parsed.message === 'string' && parsed.message !== 'Validation Failed') {
        return parsed.message;
      }
    } catch {
      // ignore JSON parse failures
    }
  }

  return raw;
}

/**
 * Normalizes an unknown error into a structured `AppError` object.
 *
 * @param error - The caught error value.
 * @param defaultCode - The fallback error code (defaults to 'UNKNOWN_ERROR').
 * @returns A structured `AppError` containing code and message.
 */
export function toAppError(error: unknown, defaultCode = 'UNKNOWN_ERROR'): AppError {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as Partial<AppError>;
    if (typeof candidate.message === 'string') {
      return {
        code: typeof candidate.code === 'string' ? candidate.code : defaultCode,
        message: candidate.message,
      };
    }
  }

  return {
    code: defaultCode,
    message: parseApiError(error),
  };
}
