# pksuid

Stripe-style prefixed, k-sortable, strictly-typed ids for TypeScript.

```ts
const id = UserId.generate(); // "user_2StGMtcWzRJ8qYqCSlSTX9Ku6hp"
```

## Why

- **Typed** — `PrefixedId<"user">` and `PrefixedId<"cus">` are different types. A bare `string` isn't assignable to either. Mixing up id types is a compile error, not a 3am page.
- **Just a string** — every id is a real string at runtime. Serializes to JSON and your DB for free. `===`, `Map` keys, `URLSearchParams`, all work with no wrapping/unwrapping.
- **Sortable** — ids of the same type sort chronologically as plain strings. No secondary `created_at` column needed for ordering or cursor pagination.
- **Self-describing** — the prefix tells you what an id points to just by looking at it, same as Stripe's `cus_`, `sub_`, `pi_`.

## Install

```bash
npm install pksuid
```

ESM-only. Runs anywhere with `Uint8Array` and `WebCrypto` (Node, browsers, edge runtimes) — no `Buffer` dependency. Node >= 24 for development.

## Quickstart

```ts
import { pksuid, type Infer } from "pksuid";

const UserId = pksuid("user");
type UserId = Infer<typeof UserId>;

const id = UserId.generate(); // "user_2StGMtcWzRJ8qYqCSlSTX9Ku6hp" as PrefixedId<"user">

UserId.parse(id); // PrefixedId<"user">, throws PksuidError if invalid
UserId.safeParse(input); // PrefixedId<"user"> | null, never throws
UserId.is(input); // type guard

UserId.timestamp(id); // Date embedded in the id
```

## API reference

| Member                  | Signature                                                  | Description                                                                |
| ----------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| `pksuid(prefix, opts?)` | `(prefix: string, opts?: { epoch?: number }) => Pksuid<P>` | Defines an id type for a given prefix.                                     |
| `.generate()`           | `() => PrefixedId<P>`                                      | Mints a new id with the current time and 16 random bytes.                  |
| `.parse(input)`         | `(input: string) => PrefixedId<P>`                         | Validates and returns the id, throws `PksuidError` otherwise.              |
| `.safeParse(input)`     | `(input: string) => PrefixedId<P> \| null`                 | Same as `.parse`, returns `null` instead of throwing.                      |
| `.is(input)`            | `(input: unknown) => input is PrefixedId<P>`               | Type guard, never throws.                                                  |
| `.timestamp(id)`        | `(id: PrefixedId<P>) => Date`                              | Extracts the embedded timestamp.                                           |
| `.min(date?)`           | `(date?: Date) => PrefixedId<P>`                           | Smallest possible id at `date`. Defaults to the start of the epoch window. |
| `.max(date?)`           | `(date?: Date) => PrefixedId<P>`                           | Largest possible id at `date`. Defaults to the end of the epoch window.    |
| `Infer<typeof X>`       | type                                                       | Extracts `PrefixedId<P>` from a `pksuid()` result for use as a type.       |

`PksuidError` carries `.code`: `"INVALID_PREFIX" | "INVALID_ID" | "INVALID_TIMESTAMP"`.

## Sorting & range queries

Ids of the same type sort lexicographically as strings, in generation order. `.min()`/`.max()` produce boundary ids for range queries and cursor pagination without a separate timestamp column:

```ts
const since = new Date("2024-01-01");

const recentUsers = await db.query("SELECT * FROM users WHERE id >= $1 ORDER BY id", [UserId.min(since)]);

// keyset pagination
const nextPage = await db.query("SELECT * FROM users WHERE id > $1 ORDER BY id LIMIT 50", [lastSeenId]);
```

## Custom epoch

```ts
const LegacyId = pksuid("legacy", { epoch: 946684800 }); // 2000-01-01T00:00:00Z
```

The default epoch (`1400000000`, 2014-05-13T16:53:20Z) gives ~136 years of range before the 4-byte timestamp wraps. A custom epoch shifts that window.

**Ids minted under different epochs must never be compared or sorted against each other — they'll compare incorrectly.** Changing an existing type's epoch after ids are already in production corrupts sort order for every id minted before the change. Pick an epoch once, per prefix, and don't touch it again.

## Format

```
user_2StGMtcWzRJ8qYqCSlSTX9Ku6hp
└──┘ └─────────────────────────┘
prefix      27-char base62

        4 bytes          16 bytes
   ┌───────────────┬─────────────────────┐
   │ seconds since  │   random payload    │
   │  epoch (BE)    │                     │
   └───────────────┴─────────────────────┘
              20 bytes total
```

Multi-segment prefixes are allowed (`pksuid("pk_live")`) — parsing splits on the _last_ underscore, so the id part is always the trailing base62 segment. Prefix must match `^[a-z][a-z0-9]*(_[a-z0-9]+)*$`.

## FAQ

- **Why not UUID?** No sort order, no type safety, and v4 wastes its bits on pure randomness.
- **Why not ULID?** No prefix, no branded type — a ULID from one entity is interchangeable with any other at the type level.
- **Why not plain KSUID?** This _is_ KSUID underneath — same 20 bytes, same base62 — plus a prefix and a compile-time type. Plain KSUID gives you neither.

## Credit

The binary layout (4-byte timestamp + 16-byte payload, base62 text encoding) descends from [segmentio/ksuid](https://github.com/segmentio/ksuid). This package is forked from [owpz/ksuid](https://github.com/owpz/ksuid). It is not wire-compatible with plain KSUID — the prefix changes the text format — and no longer targets parity with the Go implementation.

## License

MIT
