import { test } from "uvu";
import * as assert from "uvu/assert";
import { pksuid } from "../../src/pksuid.ts";
import type { PrefixedId } from "../../src/pksuid.ts";

test("PrefixedId is nominally branded per prefix (compile-time check)", () => {
  const userId: PrefixedId<"user"> = pksuid("user").generate();
  // @ts-expect-error - a PrefixedId<"user"> must not be assignable to PrefixedId<"cus">
  const cusId: PrefixedId<"cus"> = userId;

  assert.ok(cusId.length > 0);
});

test.run();
