import { defineConfig } from "oxlint";

import common from "eslint-config-neon/oxlint/common";
import node from "eslint-config-neon/oxlint/node";
import prettier from "eslint-config-neon/oxlint/prettier";
import typescript from "eslint-config-neon/oxlint/typescript";

export default defineConfig({
  extends: [common, node, typescript, prettier],
  ignorePatterns: ["dist/**", "coverage/**"],
  rules: {
    // Go-port: upstream segmentio/ksuid uses short identifiers; renaming
    // them all would make every upstream merge a conflict.
    "id-length": "off",
    // `x == null` guards are intentional shorthand for null | undefined.
    "no-eq-null": "off",
    eqeqeq: ["error", "always", { null: "ignore" }],
  },
  overrides: [
    {
      files: ["test/**"],
      rules: {
        // contract tests reference methods like `KSUID.parse` to assert the
        // API shape; they never call them unbound.
        "typescript/unbound-method": "off",
      },
    },
  ],
  options: {
    typeAware: true,
    typeCheck: true,
  },
});
