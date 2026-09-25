/**
 * In-memory Mock State Store for Lencord.
 * Manages mutable in-memory tables initialized with seed data.
 */

import type {
  Installment,
  Investment,
  LegalContract,
  Loan,
  Profile,
  SmeCreditProfile,
} from '@/types';
import {
  SEED_CONTRACTS,
  SEED_CREDIT_PROFILES,
  SEED_INSTALLMENTS,
  SEED_INVESTMENTS,
  SEED_LOANS,
  SEED_PROFILES,
} from './seedData';

export interface MockStateSnapshot {
  profiles: Profile[];
  creditProfiles: SmeCreditProfile[];
  loans: Loan[];
  investments: Investment[];
  installments: Installment[];
  contracts: LegalContract[];
}

export class MockStateStore {
  public profiles: Profile[] = [];
  public creditProfiles: SmeCreditProfile[] = [];
  public loans: Loan[] = [];
  public investments: Investment[] = [];
  public installments: Installment[] = [];
  public contracts: LegalContract[] = [];

  constructor() {
    this.reset();
  }

  /**
   * Resets all in-memory collections to a fresh clone of seed data.
   */
  public reset(): void {
    this.profiles = JSON.parse(JSON.stringify(SEED_PROFILES));
    this.creditProfiles = JSON.parse(JSON.stringify(SEED_CREDIT_PROFILES));
    this.loans = JSON.parse(JSON.stringify(SEED_LOANS));
    this.investments = JSON.parse(JSON.stringify(SEED_INVESTMENTS));
    this.installments = JSON.parse(JSON.stringify(SEED_INSTALLMENTS));
    this.contracts = JSON.parse(JSON.stringify(SEED_CONTRACTS));
  }

  /**
   * Returns a detached deep snapshot of the current state.
   */
  public getSnapshot(): MockStateSnapshot {
    return {
      profiles: JSON.parse(JSON.stringify(this.profiles)),
      creditProfiles: JSON.parse(JSON.stringify(this.creditProfiles)),
      loans: JSON.parse(JSON.stringify(this.loans)),
      investments: JSON.parse(JSON.stringify(this.investments)),
      installments: JSON.parse(JSON.stringify(this.installments)),
      contracts: JSON.parse(JSON.stringify(this.contracts)),
    };
  }
}

/**
 * Shared singleton in-memory mock state store instance.
 */
export const defaultMockStateStore = new MockStateStore();
