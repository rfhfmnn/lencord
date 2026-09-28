/**
 * Type contracts and report models for Lencord Load & Stress Testing Suite.
 * Conforms to Issue #51 and _docs/next_tasks.md Task 28.
 */

export interface LatencyMetrics {
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  throughputRps: number;
}

export interface ConcurrencyInvestmentReport {
  totalAttempts: number;
  successfulBids: number;
  rejectedOverfundingBids: number;
  deadlocks: number;
  loanRequested: number;
  initialFunded: number;
  finalFunded: number;
  remainingCapacity: number;
  overfundedAmount: number;
  overfundingRate: number; // percentage (0.00%)
  zeroOverfundingGuaranteed: boolean;
  noDeadlocksGuaranteed: boolean;
}

export interface ConnectionPoolReport {
  poolSize: number;
  totalAcquisitions: number;
  peakActiveConnections: number;
  queuedRequests: number;
  droppedConnections: number;
  connectionTimeoutErrors: number;
  connectionLeaked: number;
  poolStabilityRate: number; // percentage (100%)
}

export interface SyntheticLoadReport {
  title: string;
  timestamp: string;
  durationMs: number;
  concurrencyReport: ConcurrencyInvestmentReport;
  connectionPoolReport: ConnectionPoolReport;
  catalogLatency: LatencyMetrics;
  passSla: boolean;
  p95Compliant: boolean;
  overfundingCompliant: boolean;
  connectionPoolCompliant: boolean;
  analysisText: string;
}

export interface LoadTestOptions {
  concurrentUsers?: number;
  totalRequests?: number;
  throttleMaxRps?: number;
  poolSize?: number;
  loanRequested?: number;
  initialFunded?: number;
  bidAmount?: number;
}
