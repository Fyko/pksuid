"use strict";

// typescript-eslint doesn't support the native TS 7 compiler yet
// (https://github.com/typescript-eslint/typescript-eslint/issues/10940).
// Pin its typescript to the 5.9 JS API while the project builds with TS 7.
// Delete this file once typescript-eslint supports TS >= 7.1.
function readPackage(pkg) {
  if (pkg.name?.startsWith("@typescript-eslint/") && pkg.peerDependencies?.typescript) {
    delete pkg.peerDependencies.typescript;
    pkg.dependencies = { ...pkg.dependencies, typescript: "^5.9.3" };
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
