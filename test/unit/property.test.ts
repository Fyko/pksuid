import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { decode, encode } from "../../src/base62.ts";
import { pksuid } from "../../src/pksuid.ts";

const payload = fc.uint8Array({ minLength: 20, maxLength: 20 });

function compareBytes(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

void test("encode/decode round-trips any 20-byte payload", () => {
  fc.assert(
    fc.property(payload, bytes => {
      assert.deepEqual(decode(encode(bytes)), bytes);
    })
  );
});

void test("encoding preserves byte order as string order", () => {
  fc.assert(
    fc.property(payload, payload, (a, b) => {
      const byteOrder = compareBytes(a, b);
      const stringOrder = encode(a) < encode(b) ? -1 : encode(a) > encode(b) ? 1 : 0;
      assert.equal(stringOrder, byteOrder);
    })
  );
});

void test("parse accepts every id generate produces, for any valid prefix", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z][a-z0-9]{0,7}(?:_[a-z0-9]{1,7})?$/), prefix => {
      const type = pksuid(prefix);
      const id = type.generate();
      assert.equal(type.parse(id), id);
      assert.ok(type.is(id));
    })
  );
});
