#!/usr/bin/env node

/**
 * Performance comparison between Go and TypeScript implementations
 *
 * Runs benchmarks for both implementations and provides detailed comparison.
 */

import { execSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

interface BenchmarkResult {
  operation: string;
  iterations: number;
  totalTimeMs: number;
  avgTimeMs: number;
  opsPerSecond: number;
  memoryUsageMB?: number;
}

interface ComparisonResult {
  operation: string;
  goOpsPerSec: number;
  tsOpsPerSec: number;
  goFaster: boolean;
  speedRatio: number;
  goMemoryMB: number;
  tsMemoryMB: number;
}

class PerformanceComparison {
  private results: ComparisonResult[] = [];

  public async runComparison(): Promise<void> {
    console.log("🔥 Running Go vs TypeScript Performance Comparison\n");

    // Check if Go is installed
    try {
      execSync("go version", { stdio: "pipe" });
    } catch {
      console.error("❌ Go is not installed or not in PATH");
      console.error("Please install Go from https://golang.org/dl/");
      process.exit(1);
    }

    const perfDir = import.meta.dirname;
    const rootDir = join(import.meta.dirname, "../../");

    console.log("📊 Step 1: Running TypeScript benchmark...");

    // Run TypeScript benchmark and capture results
    try {
      execSync(`npm run benchmark`, {
        cwd: rootDir,
        stdio: "inherit",
        env: { ...process.env, CI: "true" },
      });
    } catch (error) {
      console.error("❌ TypeScript benchmark failed:", error);
      process.exit(1);
    }

    // Read TypeScript results
    const tsResultsPath = join(rootDir, "benchmark-results.json");
    let tsResults: BenchmarkResult[] = [];

    if (existsSync(tsResultsPath)) {
      try {
        const tsData = readFileSync(tsResultsPath, "utf8");
        tsResults = JSON.parse(tsData);
      } catch (error) {
        console.error("❌ Could not read TypeScript benchmark results:", error);
        process.exit(1);
      }
    } else {
      console.error("❌ TypeScript benchmark results not found");
      process.exit(1);
    }

    console.log("\n📊 Step 2: Setting up Go benchmark...");

    // Initialize Go module and get dependencies
    const goModPath = join(perfDir, "go.mod");

    if (!existsSync(goModPath)) {
      execSync("go mod init benchmark", { cwd: perfDir });
      execSync("go get github.com/segmentio/ksuid", { cwd: perfDir });
    }

    console.log("📊 Step 3: Running Go benchmark...");

    // Run Go benchmark
    try {
      execSync("go run go-benchmark.go", {
        cwd: perfDir,
        stdio: "inherit",
      });
    } catch (error) {
      console.error("❌ Go benchmark failed:", error);
      process.exit(1);
    }

    // Read Go results
    const goResultsPath = join(perfDir, "go-benchmark-results.json");
    let goResults: BenchmarkResult[] = [];

    if (existsSync(goResultsPath)) {
      try {
        const goData = readFileSync(goResultsPath, "utf8");
        const goSuite = JSON.parse(goData);
        goResults = goSuite.results;
      } catch (error) {
        console.error("❌ Could not read Go benchmark results:", error);
        process.exit(1);
      }
    } else {
      console.error("❌ Go benchmark results not found");
      process.exit(1);
    }

    console.log("\n📊 Step 4: Comparing results...");

    // Compare results
    this.compareResults(goResults, tsResults);
    this.printComparison();
    this.exportComparison();
  }

  private compareResults(goResults: BenchmarkResult[], tsResults: BenchmarkResult[]): void {
    // Operations both benchmark suites report under the same name
    const comparableOperations = [
      "Random Generation",
      "String Parsing",
      "String Encoding",
      "Buffer Conversion",
      "From Bytes",
      "Next Operation",
      "Prev Operation",
      "Comparison",
      "Sorting (1K items)",
      "Timestamp Access",
      "Payload Access",
    ];

    for (const operation of comparableOperations) {
      const goResult = goResults.find(r => r.operation === operation);
      const tsResult = tsResults.find(r => r.operation === operation);

      if (goResult && tsResult) {
        const goFaster = goResult.opsPerSecond > tsResult.opsPerSecond;
        const speedRatio = goFaster
          ? goResult.opsPerSecond / tsResult.opsPerSecond
          : tsResult.opsPerSecond / goResult.opsPerSecond;

        this.results.push({
          operation,
          goOpsPerSec: goResult.opsPerSecond,
          tsOpsPerSec: tsResult.opsPerSecond,
          goFaster,
          speedRatio,
          goMemoryMB: goResult.memoryUsageMB ?? 0,
          tsMemoryMB: tsResult.memoryUsageMB ?? 0,
        });
      }
    }
  }

  private printComparison(): void {
    console.log("\n🏁 Go vs TypeScript Performance Comparison");
    console.log("=".repeat(100));
    console.log(
      "| Operation".padEnd(22) +
        "| Go Ops/sec".padEnd(13) +
        "| TS Ops/sec".padEnd(13) +
        "| Winner".padEnd(10) +
        "| Speed Ratio".padEnd(13) +
        "| Advantage".padEnd(12) +
        "|"
    );
    console.log(
      "|" +
        "-".repeat(21) +
        "|" +
        "-".repeat(12) +
        "|" +
        "-".repeat(12) +
        "|" +
        "-".repeat(9) +
        "|" +
        "-".repeat(12) +
        "|" +
        "-".repeat(11) +
        "|"
    );

    for (const result of this.results) {
      const goOps = this.formatNumber(result.goOpsPerSec).padEnd(12);
      const tsOps = this.formatNumber(result.tsOpsPerSec).padEnd(12);
      const winner = result.goFaster ? "🟢 Go" : "🔵 TS";
      const ratio = `${result.speedRatio.toFixed(2)}x`.padEnd(12);
      const advantage = result.goFaster
        ? `${((result.speedRatio - 1) * 100).toFixed(0)}% faster`.padEnd(11)
        : `${((result.speedRatio - 1) * 100).toFixed(0)}% slower`.padEnd(11);

      console.log(
        `| ${result.operation.padEnd(20)} | ${goOps} | ${tsOps} | ${winner.padEnd(8)} | ${ratio} | ${advantage} |`
      );
    }
    console.log("=".repeat(100));

    // Summary statistics
    const goWins = this.results.filter(r => r.goFaster).length;
    const tsWins = this.results.length - goWins;
    const avgGoAdvantage =
      this.results.filter(r => r.goFaster).reduce((sum, r) => sum + r.speedRatio, 0) / Math.max(goWins, 1);
    const avgTsAdvantage =
      this.results.filter(r => !r.goFaster).reduce((sum, r) => sum + r.speedRatio, 0) / Math.max(tsWins, 1);

    console.log("\n📈 Performance Summary:");
    console.log(`🟢 Go wins: ${goWins}/${this.results.length} operations`);
    console.log(`🔵 TypeScript wins: ${tsWins}/${this.results.length} operations`);

    if (goWins > 0) {
      console.log(`🟢 Average Go advantage: ${avgGoAdvantage.toFixed(2)}x faster`);
    }

    if (tsWins > 0) {
      console.log(`🔵 Average TypeScript advantage: ${avgTsAdvantage.toFixed(2)}x faster`);
    }

    // Highlight key operations
    const generation = this.results.find(r => r.operation === "Random Generation");
    const parsing = this.results.find(r => r.operation === "String Parsing");
    const sorting = this.results.find(r => r.operation === "Sorting (1K items)");

    if (generation) {
      console.log(`\n🎯 KSUID Generation:`);
      console.log(`   Go: ${this.formatNumber(generation.goOpsPerSec)} ops/sec`);
      console.log(`   TypeScript: ${this.formatNumber(generation.tsOpsPerSec)} ops/sec`);
      console.log(`   ${generation.goFaster ? "Go" : "TypeScript"} is ${generation.speedRatio.toFixed(2)}x faster`);
    }

    if (parsing) {
      console.log(`\n🎯 KSUID Parsing:`);
      console.log(`   Go: ${this.formatNumber(parsing.goOpsPerSec)} ops/sec`);
      console.log(`   TypeScript: ${this.formatNumber(parsing.tsOpsPerSec)} ops/sec`);
      console.log(`   ${parsing.goFaster ? "Go" : "TypeScript"} is ${parsing.speedRatio.toFixed(2)}x faster`);
    }

    if (sorting) {
      const goSortItems = sorting.goOpsPerSec * 1_000;
      const tsSortItems = sorting.tsOpsPerSec * 1_000;
      console.log(`\n🎯 Sorting Performance:`);
      console.log(`   Go: ${this.formatNumber(goSortItems)} items/sec`);
      console.log(`   TypeScript: ${this.formatNumber(tsSortItems)} items/sec`);
      console.log(`   ${sorting.goFaster ? "Go" : "TypeScript"} is ${sorting.speedRatio.toFixed(2)}x faster`);
    }

    console.log("\n🏆 Overall Assessment:");

    if (goWins > tsWins) {
      const overallAdvantage =
        this.results.reduce((sum, r) => sum + (r.goFaster ? r.speedRatio : 1 / r.speedRatio), 0) / this.results.length;
      console.log(`🟢 Go is generally faster (${overallAdvantage.toFixed(2)}x average advantage)`);
      console.log("🎯 Choose Go for maximum performance");
      console.log("🎯 Choose TypeScript for excellent performance + ecosystem benefits");
    } else {
      console.log("🔵 TypeScript shows competitive or better performance");
      console.log("🎯 TypeScript is an excellent choice for KSUID operations");
    }
  }

  private formatNumber(n: number): string {
    return n.toLocaleString();
  }

  private exportComparison(): void {
    const exportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalOperations: this.results.length,
        goWins: this.results.filter(r => r.goFaster).length,
        tsWins: this.results.filter(r => !r.goFaster).length,
      },
      results: this.results,
    };

    writeFileSync("performance-comparison.json", JSON.stringify(exportData, null, 2));
    console.log("\n📊 Comparison results exported to performance-comparison.json");
  }
}

// Run comparison
if (import.meta.main) {
  const comparison = new PerformanceComparison();
  try {
    await comparison.runComparison();
  } catch (error) {
    console.error(error);
  }
}

export { PerformanceComparison };
