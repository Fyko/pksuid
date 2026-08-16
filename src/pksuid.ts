import { PksuidError } from "./errors.ts";
import { decode as base62Decode, encode as base62Encode } from "./base62.ts";

declare const idBrand: unique symbol;

/**
 * A string id of the shape `${prefix}_${27-char base62 ksuid}`, e.g.
 * `user_0ujtsYcgvSTl8PAuAdqWYSMnLOv`. Two ids with the same prefix are
 * k-sortable as plain strings: every id has the same fixed width, and the
 * suffix encodes a big-endian timestamp in its leading bytes, so ordering
 * the encoded characters orders the underlying bytes, which orders the
 * timestamps.
 */
export type PrefixedId<P extends string> = `${P}_${string}` & { readonly [idBrand]: P };

export interface PksuidOptions {
  /** Unix epoch, in seconds, subtracted from timestamps before encoding. Defaults to 1_400_000_000. */
  epoch?: number;
}

export type Infer<T> = T extends { parse(input: string): infer R } ? R : never;

const DEFAULT_EPOCH = 1_400_000_000; // 2014-05-13T16:53:20Z
const TIMESTAMP_LENGTH = 4;
const PAYLOAD_LENGTH = 16;
const ID_LENGTH = TIMESTAMP_LENGTH + PAYLOAD_LENGTH;
const MAX_TIMESTAMP_OFFSET = 0xff_ff_ff_ff;

const PREFIX_PATTERN = /^[a-z][a-z0-9]*(?<segment>_[a-z0-9]+)*$/;

/** A factory-bound family of prefixed ids, e.g. the value returned by `pksuid("user")`. */
export interface Pksuid<P extends string> {
  readonly prefix: P;
  readonly epoch: number;

  /** Generates a new id timestamped at the current time. */
  generate(): PrefixedId<P>;

  /** Validates `input` and returns it as a branded id, or throws `PksuidError`. */
  parse(input: string): PrefixedId<P>;

  /** Like `parse`, but returns `null` instead of throwing. */
  safeParse(input: string): PrefixedId<P> | null;

  /** A type guard equivalent to `safeParse(input) !== null`. */
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- a type guard over arbitrary values has to accept `unknown`; narrowing it is the function's job
  is(input: unknown): input is PrefixedId<P>;

  /** Recovers the timestamp encoded in `id`. */
  timestamp(id: PrefixedId<P>): Date;

  /** The smallest possible id for `date` (default: the epoch floor), useful as a range-query lower bound. */
  min(date?: Date): PrefixedId<P>;

  /** The largest possible id for `date` (default: the epoch ceiling), useful as a range-query upper bound. */
  max(date?: Date): PrefixedId<P>;
}

/** Splits `input` on its last underscore, returning the parts before and after it. */
function partitionOnLastUnderscore(input: string): { before: string; after: string } | null {
  const separatorIndex = input.lastIndexOf("_");
  if (separatorIndex === -1) {
    return null;
  }

  return { before: input.slice(0, separatorIndex), after: input.slice(separatorIndex + 1) };
}

/** Reads a big-endian uint32 timestamp offset out of a decoded 20-byte id. */
function readTimestampOffset(bytes: Uint8Array): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, false);
}

function assertValidTimestampOffset(offset: number, epoch: number): void {
  if (offset < 0 || offset > MAX_TIMESTAMP_OFFSET) {
    throw new PksuidError(
      `invalid timestamp: seconds since epoch ${epoch} must be between 0 and ${MAX_TIMESTAMP_OFFSET}, got ${offset}`,
      "INVALID_TIMESTAMP"
    );
  }
}

/**
 * Creates a family of branded, k-sortable ids under a given `prefix`, in the
 * style of Stripe object ids (`cus_...`, `pi_...`).
 */
export function pksuid<const P extends string>(prefix: P, options: PksuidOptions = {}): Pksuid<P> {
  if (!PREFIX_PATTERN.test(prefix)) {
    throw new PksuidError(`invalid prefix "${prefix}": must match ${PREFIX_PATTERN.source}`, "INVALID_PREFIX");
  }

  const epoch = options.epoch ?? DEFAULT_EPOCH;
  if (!Number.isInteger(epoch) || epoch < 0) {
    throw new PksuidError(`invalid epoch: must be a non-negative integer, got ${epoch}`, "INVALID_TIMESTAMP");
  }

  function buildId(offset: number, payload: Uint8Array): PrefixedId<P> {
    const bytes = new Uint8Array(ID_LENGTH);
    new DataView(bytes.buffer).setUint32(0, offset, false);
    bytes.set(payload, TIMESTAMP_LENGTH);

    // SAFETY: bytes is always ID_LENGTH long, so base62Encode always returns
    // a 27-char string, making `${prefix}_${...}` a valid PrefixedId<P>.
    return `${prefix}_${base62Encode(bytes)}` as PrefixedId<P>;
  }

  function generate(): PrefixedId<P> {
    const offset = Math.floor(Date.now() / 1_000) - epoch;
    assertValidTimestampOffset(offset, epoch);

    const payload = new Uint8Array(PAYLOAD_LENGTH);
    globalThis.crypto.getRandomValues(payload);
    return buildId(offset, payload);
  }

  function parse(input: string): PrefixedId<P> {
    const split = partitionOnLastUnderscore(input);
    if (split === null) {
      throw new PksuidError(`invalid id: "${input}" is missing a "prefix_" separator`, "INVALID_ID");
    }

    if (split.before !== prefix) {
      throw new PksuidError(`invalid id: expected prefix "${prefix}", got "${split.before}"`, "INVALID_PREFIX");
    }

    base62Decode(split.after);

    // SAFETY: split.before === prefix and split.after decoded as a valid
    // 27-char base62 ksuid, so input matches the PrefixedId<P> shape.
    return input as PrefixedId<P>;
  }

  function safeParse(input: string): PrefixedId<P> | null {
    try {
      return parse(input);
    } catch {
      return null;
    }
  }

  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- a type guard over arbitrary values has to accept `unknown`; narrowing it is the function's job
  function is(input: unknown): input is PrefixedId<P> {
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- typeof is the correct narrowing check inside this type-predicate guard
    return typeof input === "string" && safeParse(input) !== null;
  }

  function timestamp(id: PrefixedId<P>): Date {
    // id is a branded PrefixedId<P>, produced only by this instance's
    // generate/parse/min/max, all of which guarantee a
    // "prefix_<27-char base62>" shape, so a plain lastIndexOf split is safe.
    const separatorIndex = id.lastIndexOf("_");
    const bytes = base62Decode(id.slice(separatorIndex + 1));
    return new Date((readTimestampOffset(bytes) + epoch) * 1_000);
  }

  function min(date?: Date): PrefixedId<P> {
    const offset = date === undefined ? 0 : Math.floor(date.getTime() / 1_000) - epoch;
    assertValidTimestampOffset(offset, epoch);
    return buildId(offset, new Uint8Array(PAYLOAD_LENGTH).fill(0x00));
  }

  function max(date?: Date): PrefixedId<P> {
    const offset = date === undefined ? MAX_TIMESTAMP_OFFSET : Math.floor(date.getTime() / 1_000) - epoch;
    assertValidTimestampOffset(offset, epoch);
    return buildId(offset, new Uint8Array(PAYLOAD_LENGTH).fill(0xff));
  }

  return { prefix, epoch, generate, parse, safeParse, is, timestamp, min, max };
}
