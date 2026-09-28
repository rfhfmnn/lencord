/**
 * Standalone Production Load and Stress Testing Suite Executable.
 * Runnable via `npm run test:load`.
 * Conforms to Issue #51 and _docs/next_tasks.md Task 28.
 */

import { performance } from 'node:perf_hooks';
import {
  ConnectionPoolSimulator,
  generateSyntheticLoadReport,
  runAtomicOverfundingConcurrencyTest,
  runCatalogBrowsingLoadTest,
} from './concurrencyRunner';

async function main() {
  console.log('\n🚀 Starting Lencord Production Load & Stress Testing Suite...\n');
  const suiteStart = performance.now();

  // 1. Run Atomic Overfunding Concurrency Benchmark
  console.log('⚡ [1/3] Executing Concurrent Investor Bidding Benchmark (50 concurrent users)...');
  const concurrencyReport = await runAtomicOverfundingConcurrencyTest({
    concurrentUsers: 50,
    loanRequested: 1_000_000,
    initialFunded: 200_000,
    bidAmount: 50_000,
    poolSize: 20,
    throttleMaxRps: 400,
  });

  // 2. Run Connection Pool Saturation Test
  console.log('⚡ [2/3] Simulating Database Connection Pool Saturation & Queuing (100 acquisitions)...');
  const pool = new ConnectionPoolSimulator(20);
  const poolTasks = Array.from({ length: 100 }, async () => {
    const release = await pool.acquireConnection(3000);
    try {
      await new Promise((resolve) => setTimeout(resolve, 5));
    } finally {
      release();
    }
  });
  await Promise.all(poolTasks);
  const poolReport = pool.getReport();

  // 3. Run Public Catalog Browsing Latency Test
  console.log('⚡ [3/3] Benchmarking Public Catalog Browsing Latency (80 requests)...');
  const catalogLatency = await runCatalogBrowsingLoadTest({
    totalRequests: 80,
    poolSize: 20,
    throttleMaxRps: 300,
  });

  const totalDuration = performance.now() - suiteStart;

  // 4. Generate & Print Synthetic Load Report
  const syntheticReport = generateSyntheticLoadReport(
    concurrencyReport,
    poolReport,
    catalogLatency,
    totalDuration
  );

  console.log('\n' + syntheticReport.analysisText + '\n');

  if (!syntheticReport.passSla) {
    console.error('❌ Load test suite failed to meet all SLA thresholds.');
    process.exit(1);
  }

  console.log('✅ Load test suite executed successfully. All SLAs satisfied.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error during load test execution:', err);
  process.exit(1);
});
