#!/usr/bin/env node

/**
 * API Contract Checker Script
 *
 * This script helps developers run API contract tests locally before committing
 * changes that might introduce breaking changes.
 */

import { spawn } from "node:child_process";
import process from "node:process";

// Whitelist of allowed commands to prevent command injection
const ALLOWED_COMMANDS = new Set(["pnpm"]);

async function runCommand(command, args = []) {
  // Validate command against whitelist
  if (!ALLOWED_COMMANDS.has(command)) {
    throw new Error(
      `Command '${command}' is not allowed. Allowed commands: ${Array.from(ALLOWED_COMMANDS).join(", ")}`
    );
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    child.on("close", code => {
      resolve(code);
    });

    child.on("error", reject);
  });
}

async function main() {
  console.log("🔍 API Contract Checker");
  console.log("========================");
  console.log("");
  console.log("This tool helps ensure your changes don't introduce breaking changes.");
  console.log("");

  try {
    console.log("📦 Building project...");
    const buildCode = await runCommand("pnpm", ["run", "build"]);

    if (buildCode !== 0) {
      console.error("❌ Build failed. Please fix build errors before checking API contract.");
      process.exit(1);
    }

    console.log("✅ Build successful!");
    console.log("");
    console.log("🧪 Running API contract tests...");
    console.log("");

    const contractCode = await runCommand("pnpm", ["run", "test:contract"]);

    if (contractCode === 0) {
      console.log("");
      console.log("🎉 All API contract tests passed!");
      console.log("");
      console.log("✅ Your changes are safe for MINOR or PATCH releases");
      console.log("💡 No breaking changes detected - you're good to go!");
    } else {
      console.log("");
      console.log("⚠️  API contract tests failed!");
      console.log("");
      console.log("🚨 BREAKING CHANGES DETECTED");
      console.log("");
      console.log("Your changes introduce breaking changes that will require a MAJOR version bump.");
      console.log("");
      console.log("📋 Next Steps:");
      console.log("");
      console.log("1. Review the test failures above");
      console.log("2. Check docs/api-versioning.md for breaking change guidelines");
      console.log("3. Decide if these breaking changes are intentional:");
      console.log("");
      console.log("   🎯 If INTENTIONAL (new major version):");
      console.log("   - Plan for major version release (e.g., 1.0.0 → 2.0.0)");
      console.log("   - Update API contract tests to match new API");
      console.log("   - Document changes in CHANGELOG.md");
      console.log("   - Provide migration guide for users");
      console.log("");
      console.log("   🔧 If UNINTENTIONAL (maintain compatibility):");
      console.log("   - Modify your changes to avoid breaking the API");
      console.log("   - Ensure backward compatibility is maintained");
      console.log("   - Run this script again to verify");
      console.log("");
      console.log("💡 Tip: Run individual contract test suites:");
      console.log("   - pnpm test test/api-contract/api-contract.test.ts");
      console.log("   - pnpm test test/api-contract/cli-contract.test.ts");
      console.log("   - pnpm test test/api-contract/type-contract.test.ts");

      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error running API contract tests:", error.message);
    process.exit(1);
  }
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error);
  }
}

export { main };
