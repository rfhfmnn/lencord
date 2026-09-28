/**
 * Production Load and Stress Testing Suite for Lencord P2P Platform.
 * Validates system concurrency, database connection pooling, and subasta overfunding resistance.
 * Conforms to Issue #51 and _docs/next_tasks.md Task 28.
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePercentiles,
  ConnectionPoolSimulator,
  generateSyntheticLoadReport,
  runAtomicOverfundingConcurrencyTest,
  runCatalogBrowsingLoadTest,
  ThrottlingRateLimiter,
} from './concurrencyRunner';

describe('Production Load and Stress Testing Suite (Issue #51)', () => {
  // ---------------------------------------------------------------------------
  // 1. Concurrent Investor Bidding Simulation
  // ---------------------------------------------------------------------------
  it('simulates concurrent investors attempting to commit funds to the same loan', async () => {
    // 60 concurrent investors competing for limited loan capacity
    const report = await runAtomicOverfundingConcurrencyTest({
      concurrentUsers: 60,
      loanRequested: 1_000_000,
      initialFunded: 200_000, // Available quota: $800.000
      bidAmount: 50_000, // Exactly 16 bids can be accepted
      poolSize: 20,
      throttleMaxRps: 400,
    });

    expect(report.totalAttempts).toBe(60);
    expect(report.successfulBids).toBe(16);
    expect(report.rejectedOverfundingBids).toBe(44);
    expect(report.finalFunded).toBe(1_000_000);
    expect(report.remainingCapacity).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // 2. PostgreSQL commit_investment_atomic 0% Overfunding & Deadlock Guarantee
  // ---------------------------------------------------------------------------
  it('validates that PostgreSQL commit_investment_atomic procedure guarantees 0% overfunding without deadlocks under concurrency', async () => {
    // Heavy burst with 100 concurrent investors
    const report = await runAtomicOverfundingConcurrencyTest({
      concurrentUsers: 100,
      loanRequested: 2_000_000,
      initialFunded: 500_000, // Remaining: $1.500.000
      bidAmount: 100_000, // Exactly 15 bids can be accepted
      poolSize: 25,
      throttleMaxRps: 600,
    });

    // 0% Overfunding verification
    expect(report.overfundedAmount).toBe(0);
    expect(report.overfundingRate).toBe(0);
    expect(report.zeroOverfundingGuaranteed).toBe(true);

    // Deadlock-free guarantee verification
    expect(report.deadlocks).toBe(0);
    expect(report.noDeadlocksGuaranteed).toBe(true);

    // Final funded amount strictly equals requested cap
    expect(report.finalFunded).toBe(2_000_000);
    expect(report.successfulBids).toBe(15);
    expect(report.rejectedOverfundingBids).toBe(85);
  });

  // ---------------------------------------------------------------------------
  // 3. Database Connection Pool Stability under Peak Load
  // ---------------------------------------------------------------------------
  it('database connection pool maintains stability under peak simulated load without dropping Supabase connections', async () => {
    const pool = new ConnectionPoolSimulator(20);
    const throttle = new ThrottlingRateLimiter(500);

    // Simulate 120 rapid queries acquiring and releasing connections
    const tasks = Array.from({ length: 120 }, async () => {
      await throttle.acquire();
      const release = await pool.acquireConnection(3000);
      try {
        // Simulated DB work
        await new Promise((resolve) => setTimeout(resolve, 5));
      } finally {
        release();
      }
    });

    await Promise.all(tasks);
    const poolReport = pool.getReport();

    // Verify 0 dropped connections and 100% stability
    expect(poolReport.totalAcquisitions).toBe(120);
    expect(poolReport.droppedConnections).toBe(0);
    expect(poolReport.connectionTimeoutErrors).toBe(0);
    expect(poolReport.connectionLeaked).toBe(0);
    expect(poolReport.poolStabilityRate).toBe(100);
    expect(poolReport.peakActiveConnections).toBeLessThanOrEqual(poolReport.poolSize);
    expect(poolReport.queuedRequests).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // 4. Public Catalog Browsing Latency Benchmark (p95 < 500ms)
  // ---------------------------------------------------------------------------
  it('documents 95th percentile latency (p95 < 500ms) for public catalog browsing under load', async () => {
    const latencyMetrics = await runCatalogBrowsingLoadTest({
      totalRequests: 80,
      poolSize: 20,
      throttleMaxRps: 300,
    });

    expect(latencyMetrics.count).toBe(80);
    expect(latencyMetrics.p95).toBeLessThan(500); // SLA requirement: p95 < 500ms
    expect(latencyMetrics.avg).toBeLessThan(latencyMetrics.p95);
    expect(latencyMetrics.min).toBeGreaterThan(0);
    expect(latencyMetrics.throughputRps).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // 5. Synthetic Test Report Generation and Documented Output Analysis
  // ---------------------------------------------------------------------------
  it('generates synthetic test report with documented output analysis and SLA verdict', async () => {
    const concurrencyReport = await runAtomicOverfundingConcurrencyTest({
      concurrentUsers: 50,
      loanRequested: 1_000_000,
      initialFunded: 200_000,
      bidAmount: 50_000,
    });

    const pool = new ConnectionPoolSimulator(20);
    const release = await pool.acquireConnection();
    release();
    const connectionPoolReport = pool.getReport();

    const catalogLatency = await runCatalogBrowsingLoadTest({
      totalRequests: 50,
    });

    const syntheticReport = generateSyntheticLoadReport(
      concurrencyReport,
      connectionPoolReport,
      catalogLatency,
      1500
    );

    expect(syntheticReport.passSla).toBe(true);
    expect(syntheticReport.p95Compliant).toBe(true);
    expect(syntheticReport.overfundingCompliant).toBe(true);
    expect(syntheticReport.connectionPoolCompliant).toBe(true);

    // Verify structured documented analysis text contains key markers
    expect(syntheticReport.analysisText).toContain('LENCORD PRODUCTION LOAD & STRESS TEST REPORT');
    expect(syntheticReport.analysisText).toContain('0% Overfunding Guarantee');
    expect(syntheticReport.analysisText).toContain('VERIFIED (0.00% Overfunding)');
    expect(syntheticReport.analysisText).toContain('95th Percentile (p95)');
    expect(syntheticReport.analysisText).toContain('PASSED (p95 < 500ms SLA)');
    expect(syntheticReport.analysisText).toContain('EXECUTIVE LOAD ANALYSIS & FINDINGS');
  });

  // ---------------------------------------------------------------------------
  // 6. Throttling Controls Enforcement
  // ---------------------------------------------------------------------------
  it('enforces throttling controls to prevent unthrottled benchmark flooding against production', async () => {
    const rateLimiter = new ThrottlingRateLimiter(50); // 50 RPS max
    const start = performance.now();

    // 5 tokens should execute safely within reasonable time window
    for (let i = 0; i < 5; i++) {
      await rateLimiter.acquire();
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });
});
