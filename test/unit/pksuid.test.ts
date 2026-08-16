import { test } from "uvu";
import * as assert from "uvu/assert";
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

test("generate produces the prefix followed by an underscore and 27 base62 characters", () => {
  const user = pksuid("user");
  const id = user.generate();

  assert.ok(id.startsWith("user_"));
  assert.is(id.length, "user_".length + 27);
  assert.match(id.slice("user_".length), /^[0-9A-Za-z]{27}$/);
});

test("is/parse round-trip on a generated id", () => {
  const user = pksuid("user");
  const id = user.generate();

  assert.ok(user.is(id));
  assert.is(user.parse(id), id);
});

test("generate produces unique ids", () => {
  const user = pksuid("user");
  const seen = new Set<string>();

  for (let i = 0; i < 1_000; i++) {
    seen.add(user.generate());
  }

  assert.is(seen.size, 1_000);
});

test("parse rejects a wrong prefix", () => {
  const user = pksuid("user");
  const id = pksuid("cus").generate();

  assert.is(
    codeOf(() => user.parse(id)),
    "INVALID_PREFIX"
  );
});

test("parse rejects a suffix with the wrong length", () => {
  const user = pksuid("user");
  assert.is(
    codeOf(() => user.parse("user_short")),
    "INVALID_ID"
  );
});

test("parse rejects a suffix with invalid characters", () => {
  const user = pksuid("user");
  assert.is(
    codeOf(() => user.parse(`user_${"!".repeat(27)}`)),
    "INVALID_ID"
  );
});

test("parse rejects an id with no underscore", () => {
  const user = pksuid("user");
  assert.is(
    codeOf(() => user.parse("a".repeat(31))),
    "INVALID_ID"
  );
});

test("safeParse never throws and returns null for every invalid case", () => {
  const user = pksuid("user");
  const cus = pksuid("cus").generate();

  assert.is(user.safeParse(cus), null);
  assert.is(user.safeParse("user_short"), null);
  assert.is(user.safeParse(`user_${"!".repeat(27)}`), null);
  assert.is(user.safeParse("a".repeat(31)), null);
  assert.is(user.safeParse(""), null);
});

test("is is false for non-strings and never throws", () => {
  const user = pksuid("user");

  assert.not.ok(user.is(42));
  assert.not.ok(user.is(null));
  assert.not.ok(user.is(undefined));
  assert.not.ok(user.is({}));
});

test("multi-segment prefixes generate and parse correctly", () => {
  const pkLive = pksuid("pk_live");
  const id = pkLive.generate();

  assert.ok(id.startsWith("pk_live_"));
  assert.ok(pkLive.is(id));
  assert.is(pkLive.parse(id), id);
});

test("a shorter prefix does not parse a longer prefix's id, even sharing a segment", () => {
  const pk = pksuid("pk");
  const id = pksuid("pk_live").generate();

  assert.is(
    codeOf(() => pk.parse(id)),
    "INVALID_PREFIX"
  );
});

test("timestamp round-trips within a second of Date.now", () => {
  const user = pksuid("user");
  const before = Date.now();
  const id = user.generate();
  const after = Date.now();

  const ts = user.timestamp(id).getTime();
  assert.ok(ts >= Math.floor(before / 1_000) * 1_000);
  assert.ok(ts <= Math.ceil(after / 1_000) * 1_000);
});

test("a custom epoch shifts the timestamp but round-trips correctly", () => {
  const user = pksuid("user", { epoch: 0 });
  const id = user.generate();

  const ts = user.timestamp(id).getTime();
  assert.ok(Math.abs(ts - Date.now()) < 2_000);
});

test("min/max bound generated ids for the same date range", () => {
  const user = pksuid("user");
  const now = new Date();
  const lower = user.min(now);
  const upper = user.max(now);
  const id = user.generate();

  assert.ok(lower < id);
  assert.ok(id < upper);
});

test("ids sort lexicographically by increasing timestamp", () => {
  const user = pksuid("user");
  const earlier = user.min(new Date(Date.now() - 60_000));
  const later = user.min(new Date());

  assert.ok(earlier < later);
});

test("factory rejects invalid prefixes", () => {
  for (const bad of ["User", "1a", "a__b", "", "a_"]) {
    assert.is(
      codeOf(() => pksuid(bad)),
      "INVALID_PREFIX"
    );
  }
});

test("factory accepts a valid multi-segment prefix", () => {
  assert.not.throws(() => pksuid("pk_live"));
});

test("factory rejects an invalid epoch", () => {
  assert.is(
    codeOf(() => pksuid("user", { epoch: -1 })),
    "INVALID_TIMESTAMP"
  );
  assert.is(
    codeOf(() => pksuid("user", { epoch: 1.5 })),
    "INVALID_TIMESTAMP"
  );
});

test.run();
