import { test } from "node:test";
import assert from "node:assert/strict";
import { pksuid } from "../../src/pksuid.ts";
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

void test("generate produces the prefix followed by an underscore and 27 base62 characters", () => {
  const user = pksuid("user");
  const id = user.generate();

  assert.ok(id.startsWith("user_"));
  assert.equal(id.length, "user_".length + 27);
  assert.match(id.slice("user_".length), /^[0-9A-Za-z]{27}$/);
});

void test("is/parse round-trip on a generated id", () => {
  const user = pksuid("user");
  const id = user.generate();

  assert.ok(user.is(id));
  assert.equal(user.parse(id), id);
});

void test("generate produces unique ids", () => {
  const user = pksuid("user");
  const seen = new Set<string>();

  for (let i = 0; i < 1_000; i++) {
    seen.add(user.generate());
  }

  assert.equal(seen.size, 1_000);
});

void test("parse rejects a wrong prefix", () => {
  const user = pksuid("user");
  const id = pksuid("cus").generate();

  assert.equal(
    codeOf(() => user.parse(id)),
    "INVALID_PREFIX"
  );
});

void test("parse rejects a suffix with the wrong length", () => {
  const user = pksuid("user");
  assert.equal(
    codeOf(() => user.parse("user_short")),
    "INVALID_ID"
  );
});

void test("parse rejects a suffix with invalid characters", () => {
  const user = pksuid("user");
  assert.equal(
    codeOf(() => user.parse(`user_${"!".repeat(27)}`)),
    "INVALID_ID"
  );
});

void test("parse rejects an id with no underscore", () => {
  const user = pksuid("user");
  assert.equal(
    codeOf(() => user.parse("a".repeat(31))),
    "INVALID_ID"
  );
});

void test("safeParse never throws and returns null for every invalid case", () => {
  const user = pksuid("user");
  const cus = pksuid("cus").generate();

  assert.equal(user.safeParse(cus), null);
  assert.equal(user.safeParse("user_short"), null);
  assert.equal(user.safeParse(`user_${"!".repeat(27)}`), null);
  assert.equal(user.safeParse("a".repeat(31)), null);
  assert.equal(user.safeParse(""), null);
});

void test("is is false for non-strings and never throws", () => {
  const user = pksuid("user");

  assert.ok(!user.is(42));
  assert.ok(!user.is(null));
  assert.ok(!user.is(undefined));
  assert.ok(!user.is({}));
});

void test("multi-segment prefixes generate and parse correctly", () => {
  const pkLive = pksuid("pk_live");
  const id = pkLive.generate();

  assert.ok(id.startsWith("pk_live_"));
  assert.ok(pkLive.is(id));
  assert.equal(pkLive.parse(id), id);
});

void test("a shorter prefix does not parse a longer prefix's id, even sharing a segment", () => {
  const pk = pksuid("pk");
  const id = pksuid("pk_live").generate();

  assert.equal(
    codeOf(() => pk.parse(id)),
    "INVALID_PREFIX"
  );
});

void test("timestamp round-trips within a second of Date.now", () => {
  const user = pksuid("user");
  const before = Date.now();
  const id = user.generate();
  const after = Date.now();

  const ts = user.timestamp(id).getTime();
  assert.ok(ts >= Math.floor(before / 1_000) * 1_000);
  assert.ok(ts <= Math.ceil(after / 1_000) * 1_000);
});

void test("a custom epoch shifts the timestamp but round-trips correctly", () => {
  const user = pksuid("user", { epoch: 0 });
  const id = user.generate();

  const ts = user.timestamp(id).getTime();
  assert.ok(Math.abs(ts - Date.now()) < 2_000);
});

void test("min/max bound generated ids for the same date range", () => {
  const user = pksuid("user");
  const now = new Date();
  const lower = user.min(now);
  const upper = user.max(now);
  const id = user.generate();

  assert.ok(lower < id);
  assert.ok(id < upper);
});

void test("ids sort lexicographically by increasing timestamp", () => {
  const user = pksuid("user");
  const earlier = user.min(new Date(Date.now() - 60_000));
  const later = user.min(new Date());

  assert.ok(earlier < later);
});

void test("factory rejects invalid prefixes", () => {
  for (const bad of ["User", "1a", "a__b", "", "a_"]) {
    assert.equal(
      codeOf(() => pksuid(bad)),
      "INVALID_PREFIX"
    );
  }
});

void test("factory accepts a valid multi-segment prefix", () => {
  assert.doesNotThrow(() => pksuid("pk_live"));
});

void test("factory rejects an invalid epoch", () => {
  assert.equal(
    codeOf(() => pksuid("user", { epoch: -1 })),
    "INVALID_TIMESTAMP"
  );
  assert.equal(
    codeOf(() => pksuid("user", { epoch: 1.5 })),
    "INVALID_TIMESTAMP"
  );
});
