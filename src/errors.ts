/**
 * Error codes for programmatic error handling.
 */
export type PksuidErrorCode = "INVALID_PREFIX" | "INVALID_ID" | "INVALID_TIMESTAMP";

/**
 * The single error type thrown by pksuid. Prefer switching on `code` rather
 * than matching the message text, which may change between versions.
 */
export class PksuidError extends Error {
  public readonly code: PksuidErrorCode;

  public constructor(message: string, code: PksuidErrorCode) {
    super(message);

    this.name = "PksuidError";
    this.code = code;

    // Maintain stack trace (V8 only)
    Error.captureStackTrace?.(this, PksuidError);
  }
}
