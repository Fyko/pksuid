#!/usr/bin/env node

/**
 * Stress testing suite for @owpz/ksuid
 *
 * Tests the library under high load and memory pressure to validate
 * production readiness claims.
 */

import { KSUID, Sequence } from "../../src/index.ts";
import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";
import { setImmediate as yieldToEventLoop } from "node:timers/promises";
import { setInterval, clearInterval } from "node:timers";
import process from "node:process";

interface StressTestResult {
  testName: string;
  duration: number;
  operations: number;
  opsPerSecond: number;
  memoryPeakMB: number;
  memoryFinalMB: number;
  errors: number;
  success: boolean;
}

class StressTest {
  private results: StressTestResult[] = [];

  public async run(
    testName: string,
    duration: number,
    operation: () => Promise<void> | void,
    options: {
      memoryLimit?: number;
      expectedMinOps?: number;
      collectGarbage?: boolean;
    } = {}
  ): Promise<StressTestResult> {
    console.log(`🔥 Running stress test: ${testName} (${duration}s)`);

    let operations = 0;
    let errors = 0;
    let memoryPeakMB = 0;

    const startTime = performance.now();
    const endTime = startTime + duration * 1_000;

    // Monitor memory usage
    const memoryInterval = setInterval(() => {
      const currentMemoryMB = process.memoryUsage().heapUsed / 1_024 / 1_024;
      memoryPeakMB = Math.max(memoryPeakMB, currentMemoryMB);

      // Check memory limit
      if (options.memoryLimit && currentMemoryMB > options.memoryLimit) {
        console.warn(`⚠️ Memory usage (${currentMemoryMB.toFixed(2)}MB) exceeded limit (${options.memoryLimit}MB)`);
      }
    }, 100);

    // Run operations until time expires
    while (performance.now() < endTime) {
      try {
        await operation();
        operations++;

        // Optional garbage collection
        if (options.collectGarbage && operations % 10_000 === 0 && global.gc) {
          global.gc();
        }

        // Yield occasionally to prevent blocking
        if (operations % 1_000 === 0) {
          await yieldToEventLoop();
        }
      } catch (error) {
        errors++;
        if (errors < 5) {
          // Only log first few errors
          console.error(`Error in ${testName}:`, error);
        }
      }
    }

    clearInterval(memoryInterval);

    const actualDuration = (performance.now() - startTime) / 1_000;
    const opsPerSecond = Math.round(operations / actualDuration);
    const memoryFinalMB = process.memoryUsage().heapUsed / 1_024 / 1_024;

    const success =
      errors === 0 &&
      (!options.expectedMinOps || opsPerSecond >= options.expectedMinOps) &&
      (!options.memoryLimit || memoryPeakMB <= options.memoryLimit);

    const result: StressTestResult = {
      testName,
      duration: Math.round(actualDuration * 100) / 100,
      operations,
      opsPerSecond,
      memoryPeakMB: Math.round(memoryPeakMB * 100) / 100,
      memoryFinalMB: Math.round(memoryFinalMB * 100) / 100,
      errors,
      success,
    };

    this.results.push(result);

    const status = success ? "✅ PASS" : "❌ FAIL";
    console.log(
      `   ${status} - ${operations.toLocaleString()} ops (${opsPerSecond.toLocaleString()} ops/sec, Peak: ${memoryPeakMB.toFixed(1)}MB)`
    );

    return result;
  }

  public printResults(): void {
    console.log("\n🚀 Stress Test Results");
    console.log("=".repeat(90));
    console.log(
      "| Test Name".padEnd(25) +
        "| Ops/sec".padEnd(12) +
        "| Total Ops".padEnd(12) +
        "| Peak MB".padEnd(10) +
        "| Errors".padEnd(8) +
        "| Status".padEnd(8) +
        "|"
    );
    console.log(
      "|" +
        "-".repeat(24) +
        "|" +
        "-".repeat(11) +
        "|" +
        "-".repeat(11) +
        "|" +
        "-".repeat(9) +
        "|" +
        "-".repeat(7) +
        "|" +
        "-".repeat(7) +
        "|"
    );

    for (const result of this.results) {
      const opsFormatted = result.opsPerSecond.toLocaleString().padEnd(11);
      const totalFormatted = result.operations.toLocaleString().padEnd(11);
      const memFormatted = result.memoryPeakMB.toFixed(1).padEnd(9);
      const errorsFormatted = result.errors.toString().padEnd(7);
      const statusFormatted = (result.success ? "✅ PASS" : "❌ FAIL").padEnd(7);

      console.log(
        `| ${result.testName.padEnd(23)} | ${opsFormatted} | ${totalFormatted} | ${memFormatted} | ${errorsFormatted} | ${statusFormatted} |`
      );
    }
    console.log("=".repeat(90));
  }

  public getResults(): StressTestResult[] {
    return this.results;
  }

  public getOverallSuccess(): boolean {
    return this.results.every(r => r.success);
  }
}

/**
 * Main stress testing function
 */
async function runStressTests(): Promise<void> {
  console.log("🔥 Starting @owpz/ksuid stress tests...\n");

  const stressTest = new StressTest();

  // Test 1: High-throughput generation
  await stressTest.run(
    "High Throughput Gen",
    10, // 10 seconds
    () => {
      KSUID.random();
    },
    { expectedMinOps: 50_000, memoryLimit: 100 }
  );

  // Test 2: Continuous parsing
  const testStrings = Array.from({ length: 1_000 }, () => KSUID.random().toString());
  let parseIndex = 0;

  await stressTest.run(
    "Continuous Parsing",
    10,
    () => {
      KSUID.parse(testStrings[parseIndex++ % testStrings.length]);
    },
    { expectedMinOps: 80_000, memoryLimit: 50 }
  );

  // Test 3: Memory pressure test
  const ksuids: KSUID[] = [];
  await stressTest.run(
    "Memory Pressure",
    5,
    () => {
      ksuids.push(KSUID.random());
      // Occasionally remove old ones to prevent runaway memory
      if (ksuids.length > 50_000) {
        ksuids.splice(0, 10_000);
      }
    },
    { expectedMinOps: 40_000, memoryLimit: 200 }
  );

  // Test 4: Sequence generation under load
  await stressTest.run(
    "Sequence Load",
    8,
    () => {
      const sequence = new Sequence({ seed: KSUID.random() });
      // Generate small batches
      for (let i = 0; i < 10; i++) {
        sequence.next();
      }
    },
    { expectedMinOps: 5_000, memoryLimit: 100 }
  );

  // Test 5: Mixed operations (realistic workload)
  const mixedData = Array.from({ length: 1_000 }, () => KSUID.random());
  let mixedIndex = 0;

  await stressTest.run(
    "Mixed Operations",
    15,
    () => {
      const operation = mixedIndex % 4;
      mixedIndex++;

      switch (operation) {
        case 0:
          void KSUID.random();
          break;
        case 1:
          void mixedData[mixedIndex % mixedData.length].toString();
          break;
        case 2:
          void mixedData[mixedIndex % mixedData.length].next();
          break;
        case 3:
          void KSUID.parse(mixedData[mixedIndex % mixedData.length].toString());
          break;
      }
    },
    { expectedMinOps: 30_000, memoryLimit: 150 }
  );

  // Test 6: Concurrent operations simulation
  await stressTest.run(
    "Concurrent Sim",
    5,
    async () => {
      // Simulate concurrent operations with Promise.all
      await Promise.all([
        Promise.resolve(KSUID.random()),
        Promise.resolve(KSUID.random()),
        Promise.resolve(KSUID.random()),
      ]);
    },
    { expectedMinOps: 15_000, memoryLimit: 100 }
  );

  stressTest.printResults();

  // Summary
  const results = stressTest.getResults();
  const totalOperations = results.reduce((sum, r) => sum + r.operations, 0);
  const averageOpsPerSec = Math.round(results.reduce((sum, r) => sum + r.opsPerSecond, 0) / results.length);
  const maxMemoryUsage = Math.max(...results.map(r => r.memoryPeakMB));
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

  console.log("\n📈 Stress Test Summary:");
  console.log(`🎯 Total Operations: ${totalOperations.toLocaleString()}`);
  console.log(`🎯 Average Throughput: ${averageOpsPerSec.toLocaleString()} ops/sec`);
  console.log(`💾 Peak Memory Usage: ${maxMemoryUsage.toFixed(1)} MB`);
  console.log(`❌ Total Errors: ${totalErrors}`);

  const overallSuccess = stressTest.getOverallSuccess();
  console.log(`📊 Overall Result: ${overallSuccess ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}`);

  // Production readiness assessment
  console.log("\n🏭 Production Readiness Assessment:");

  if (averageOpsPerSec > 40_000) {
    console.log("✅ High-throughput performance: Suitable for production workloads");
  } else {
    console.log("⚠️ Moderate performance: May require optimization for high-load scenarios");
  }

  if (maxMemoryUsage < 150) {
    console.log("✅ Efficient memory usage: Low memory footprint");
  } else {
    console.log("⚠️ Higher memory usage: Monitor in production environments");
  }

  if (totalErrors === 0) {
    console.log("✅ Error-free operation: Reliable under stress");
  } else {
    console.log(`❌ Errors detected: ${totalErrors} errors need investigation`);
  }

  // Export results for CI
  if (process.env.CI) {
    const resultsJson = JSON.stringify(
      {
        summary: {
          totalOperations,
          averageOpsPerSec,
          maxMemoryUsage,
          totalErrors,
          overallSuccess,
        },
        details: results,
      },
      null,
      2
    );
    writeFileSync("stress-test-results.json", resultsJson);
    console.log("📊 Stress test results exported to stress-test-results.json");
  }

  console.log("\n✨ Stress testing complete!");

  // Exit with error code if tests failed
  if (!overallSuccess) {
    process.exit(1);
  }
}

// Run stress tests
if (import.meta.main) {
  try {
    await runStressTests();
  } catch (error) {
    console.error(error);
  }
}

export { runStressTests, StressTest };
