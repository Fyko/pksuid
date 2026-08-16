import { PksuidError } from "./errors.ts";

const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = 62n;
const KSUID_BYTE_LENGTH = 20;
const ENCODED_STRING_LENGTH = 27;

const CHAR_VALUES = new Map<string, bigint>();
for (let i = 0; i < BASE62_ALPHABET.length; i++) {
  CHAR_VALUES.set(BASE62_ALPHABET[i], BigInt(i));
}

/**
 * Encodes a fixed 20-byte KSUID payload (4-byte big-endian timestamp + 16-byte
 * random payload) into a fixed 27-character base62 string. The whole payload
 * is treated as one 160-bit positional number and left-padded with zero
 * digits, not with base-x's leading-zero-byte convention, which would make
 * the width depend on how many leading 0x00 bytes the payload happens to
 * have. Because every id of a given shape encodes to the same width, plain
 * string comparison of two encoded ids matches the byte-order comparison of
 * their payloads.
 */
export function encode(bytes: Uint8Array): string {
  if (bytes.length !== KSUID_BYTE_LENGTH) {
    throw new PksuidError(`invalid id: expected ${KSUID_BYTE_LENGTH} bytes, got ${bytes.length}`, "INVALID_ID");
  }

  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }

  let encoded = "";
  while (value > 0n) {
    const remainder = value % BASE;
    value /= BASE;
    encoded = BASE62_ALPHABET[Number(remainder)] + encoded;
  }

  encoded = encoded.padStart(ENCODED_STRING_LENGTH, "0");
  if (encoded.length > ENCODED_STRING_LENGTH) {
    throw new PksuidError(`invalid id: encoded value exceeds ${ENCODED_STRING_LENGTH} characters`, "INVALID_ID");
  }

  return encoded;
}

/**
 * Decodes a 27-character base62 string back into its 20-byte form,
 * left-padding with zero bytes so the result is always fixed-width.
 */
export function decode(value: string): Uint8Array {
  if (value.length !== ENCODED_STRING_LENGTH) {
    throw new PksuidError(
      `invalid id: expected ${ENCODED_STRING_LENGTH} characters, got ${value.length}`,
      "INVALID_ID"
    );
  }

  let num = 0n;
  for (const char of value) {
    const digit = CHAR_VALUES.get(char);
    if (digit === undefined) {
      throw new PksuidError(`invalid id: contains a non-base62 character "${char}"`, "INVALID_ID");
    }

    num = num * BASE + digit;
  }

  const bytes = new Uint8Array(KSUID_BYTE_LENGTH);
  for (let i = KSUID_BYTE_LENGTH - 1; i >= 0 && num > 0n; i--) {
    bytes[i] = Number(num & 0xffn);
    num >>= 8n;
  }

  if (num > 0n) {
    throw new PksuidError(`invalid id: decoded value exceeds ${KSUID_BYTE_LENGTH} bytes`, "INVALID_ID");
  }

  return bytes;
}
