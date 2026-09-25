/**
 * In-memory Mock Payment Gateway.
 * Conforms to PaymentGatewayInterface in _docs/plan.md Section 8.2 and @/types.
 * Simulates BaaS operations (Bind, Pomelo, Coelsa) in-memory with controllable latency and simulated failures.
 */

import type { PaymentGatewayInterface } from '@/types';

export interface MockPaymentHold {
  holdId: string;
  investorId: string;
  amount: number;
  loanId: string;
  status: 'held' | 'released';
  createdAt: string;
}

export interface MockDisbursement {
  transferId: string;
  loanId: string;
  cbuTarget: string;
  amount: number;
  createdAt: string;
}

export interface MockInstallmentCollection {
  paymentId: string;
  installmentId: string;
  cbuSource: string;
  amount: number;
  status: 'pending' | 'settled';
  createdAt: string;
}

export type PaymentMethodName =
  | 'holdFunds'
  | 'releaseFunds'
  | 'disburseLoan'
  | 'collectInstallment';

export interface FailureConfig {
  fail: boolean;
  throwError?: boolean;
  errorMessage?: string;
}

export class MockPaymentGateway implements PaymentGatewayInterface {
  private latencyMs: number = 0;
  private failures: Map<PaymentMethodName | 'all', FailureConfig> = new Map();

  private holds: Map<string, MockPaymentHold> = new Map();
  private disbursements: MockDisbursement[] = [];
  private collections: MockInstallmentCollection[] = [];

  constructor(options?: { latencyMs?: number }) {
    if (options?.latencyMs) {
      this.latencyMs = options.latencyMs;
    }
  }

  // ---------------------------------------------------------------------------
  // Control & Testing Hooks
  // ---------------------------------------------------------------------------

  /**
   * Sets artificial latency in milliseconds for all gateway calls.
   */
  public setLatency(ms: number): void {
    this.latencyMs = Math.max(0, ms);
  }

  /**
   * Configures a simulated failure on one or all gateway methods.
   * If throwError is true (default), the call throws an Error.
   * If throwError is false, the method returns a failed response object (success: false / status: pending).
   */
  public simulateFailure(
    method: PaymentMethodName | 'all',
    fail: boolean = true,
    config?: { throwError?: boolean; errorMessage?: string }
  ): void {
    if (!fail) {
      this.failures.delete(method);
    } else {
      this.failures.set(method, {
        fail: true,
        throwError: config?.throwError ?? true,
        errorMessage:
          config?.errorMessage ??
          `Simulated payment failure on ${method} via MockPaymentGateway`,
      });
    }
  }

  /**
   * Clears all simulated failures.
   */
  public clearFailures(): void {
    this.failures.clear();
  }

  /**
   * Resets all in-memory records and simulation configurations.
   */
  public reset(): void {
    this.latencyMs = 0;
    this.failures.clear();
    this.holds.clear();
    this.disbursements = [];
    this.collections = [];
  }

  public getHolds(): MockPaymentHold[] {
    return Array.from(this.holds.values());
  }

  public getHoldById(holdId: string): MockPaymentHold | undefined {
    return this.holds.get(holdId);
  }

  public getDisbursements(): MockDisbursement[] {
    return [...this.disbursements];
  }

  public getCollections(): MockInstallmentCollection[] {
    return [...this.collections];
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  private async applySimulation(
    method: PaymentMethodName
  ): Promise<{ shouldReturnFailure: boolean; errorMessage?: string }> {
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }

    const failure = this.failures.get(method) ?? this.failures.get('all');
    if (failure && failure.fail) {
      if (failure.throwError) {
        throw new Error(failure.errorMessage);
      }
      return { shouldReturnFailure: true, errorMessage: failure.errorMessage };
    }

    return { shouldReturnFailure: false };
  }

  // ---------------------------------------------------------------------------
  // PaymentGatewayInterface Implementation
  // ---------------------------------------------------------------------------

  public async holdFunds(
    investorId: string,
    amount: number,
    loanId: string
  ): Promise<{ holdId: string; success: boolean }> {
    const simulation = await this.applySimulation('holdFunds');
    if (simulation.shouldReturnFailure) {
      return { holdId: '', success: false };
    }

    if (amount <= 0) {
      throw new Error('Hold amount must be greater than zero');
    }

    const holdId = `hold_${Math.random().toString(36).substring(2, 10)}`;
    const holdRecord: MockPaymentHold = {
      holdId,
      investorId,
      amount,
      loanId,
      status: 'held',
      createdAt: new Date().toISOString(),
    };

    this.holds.set(holdId, holdRecord);
    return { holdId, success: true };
  }

  public async releaseFunds(holdId: string): Promise<{ success: boolean }> {
    const simulation = await this.applySimulation('releaseFunds');
    if (simulation.shouldReturnFailure) {
      return { success: false };
    }

    const hold = this.holds.get(holdId);
    if (!hold) {
      return { success: false };
    }

    hold.status = 'released';
    return { success: true };
  }

  public async disburseLoan(
    loanId: string,
    cbuTarget: string,
    amount: number
  ): Promise<{ transferId: string; success: boolean }> {
    const simulation = await this.applySimulation('disburseLoan');
    if (simulation.shouldReturnFailure) {
      return { transferId: '', success: false };
    }

    if (amount <= 0) {
      throw new Error('Disbursement amount must be greater than zero');
    }

    if (!cbuTarget || cbuTarget.length !== 22) {
      throw new Error('Invalid destination CBU/CVU: must be 22 digits');
    }

    const transferId = `tr_${Math.random().toString(36).substring(2, 10)}`;
    const disbursement: MockDisbursement = {
      transferId,
      loanId,
      cbuTarget,
      amount,
      createdAt: new Date().toISOString(),
    };

    this.disbursements.push(disbursement);
    return { transferId, success: true };
  }

  public async collectInstallment(
    installmentId: string,
    cbuSource: string,
    amount: number
  ): Promise<{ paymentId: string; status: 'pending' | 'settled' }> {
    const simulation = await this.applySimulation('collectInstallment');
    if (simulation.shouldReturnFailure) {
      return { paymentId: '', status: 'pending' };
    }

    if (amount <= 0) {
      throw new Error('Installment collection amount must be greater than zero');
    }

    const paymentId = `pay_${Math.random().toString(36).substring(2, 10)}`;
    const collection: MockInstallmentCollection = {
      paymentId,
      installmentId,
      cbuSource,
      amount,
      status: 'settled',
      createdAt: new Date().toISOString(),
    };

    this.collections.push(collection);
    return { paymentId, status: 'settled' };
  }
}

export const defaultMockPaymentGateway = new MockPaymentGateway();
