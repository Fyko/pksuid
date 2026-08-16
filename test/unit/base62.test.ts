import { test } from "node:test";
import assert from "node:assert/strict";
import { decode, encode } from "../../src/base62.ts";
import { PksuidError } from "../../src/errors.ts";
import type { PksuidErrorCode } from "../../src/errors.ts";

function codeOf(fn: () => void): PksuidErrorCode {
  try {
    fn();
  } catch (error) {
    if (error instanceof PksuidError) {
      return error.code;
    }
    throw error;
  }
  throw new Error("expected function to throw a PksuidError");
}

void test("round-trips an all-zero buffer", () => {
  const zero = new Uint8Array(20).fill(0x00);
  const encoded = encode(zero);

  assert.equal(encoded.length, 27);
  assert.equal(encoded, "0".repeat(27));
  assert.deepEqual(decode(encoded), zero);
});

void test("round-trips a buffer with a leading-zero-byte prefix", () => {
  const bytes = new Uint8Array(20);
  bytes.set([0xab, 0xcd], 18);
  const encoded = encode(bytes);

  assert.equal(encoded.length, 27);
  assert.deepEqual(decode(encoded), bytes);
});

void test("round-trips an all-0xff buffer", () => {
  const max = new Uint8Array(20).fill(0xff);
  const encoded = encode(max);

  assert.equal(encoded.length, 27);
  assert.deepEqual(decode(encoded), max);
});

void test("round-trips a random-looking buffer", () => {
  const bytes = new Uint8Array([
    0x05, 0xa9, 0xa8, 0x44, 0x66, 0x9f, 0x7e, 0xfd, 0x7b, 0x6f, 0xe8, 0x12, 0x27, 0x84, 0x86, 0x08, 0x58, 0x78, 0x56,
    0x3d,
  ]);
  const encoded = encode(bytes);

  assert.equal(encoded.length, 27);
  assert.deepEqual(decode(encoded), bytes);
});

void test("encode throws PksuidError INVALID_ID for a buffer that is too short", () => {
  assert.equal(
    codeOf(() => encode(new Uint8Array(19))),
    "INVALID_ID"
  );
});

void test("encode throws PksuidError INVALID_ID for a buffer that is too long", () => {
  assert.equal(
    codeOf(() => encode(new Uint8Array(21))),
    "INVALID_ID"
  );
});

void test("decode throws PksuidError INVALID_ID for the wrong string length", () => {
  for (const bad of ["short", "a".repeat(28)]) {
    assert.equal(
      codeOf(() => decode(bad)),
      "INVALID_ID"
    );
  }
});

void test("decode throws PksuidError INVALID_ID for a non-base62 character", () => {
  assert.equal(
    codeOf(() => decode("!".repeat(27))),
    "INVALID_ID"
  );
});
