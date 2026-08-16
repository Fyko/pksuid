import { defineConfig } from "oxlint";

import common from "eslint-config-neon/oxlint/common";
import node from "eslint-config-neon/oxlint/node";
import prettier from "eslint-config-neon/oxlint/prettier";
import typescript from "eslint-config-neon/oxlint/typescript";

export default defineConfig({
  extends: [common, node, typescript, prettier],
  ignorePatterns: [
    "dist/**",
    "coverage/**",
    ".claude/**",
    ".vscode/**",
    "tools/oxlint/anti-slop/**",
  ],
  jsPlugins: [{ name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" }],
  rules: {
    "anti-slop/no-chained-type-assertions": "error",
    "anti-slop/no-conditional-empty-object-spread": "error",
    "anti-slop/no-known-value-widening": "error",
    "anti-slop/no-module-mocking": "error",
    "anti-slop/no-object-parameters": "error",
    "anti-slop/no-reflect-apply": "error",
    "anti-slop/no-reflect-get": "error",
    "anti-slop/no-runtime-typeof": "error",
    "anti-slop/no-shape-in-symbol-names": "error",
    "anti-slop/no-unknown-parameters": "error",
    "anti-slop/no-unknown-returns": "error",
    "anti-slop/no-unknown-type-aliases": "error",
    "anti-slop/no-unsafe-dictionary-type": "error",
    "anti-slop/no-widen-then-assert": "error",
    "anti-slop/require-safety-comment-for-type-assertion": "error",
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
