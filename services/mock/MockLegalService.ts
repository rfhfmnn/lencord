/**
 * In-memory Mock Legal Service.
 * Conforms to LegalServiceInterface in _docs/plan.md Section 7 and @/types.
 * Handles electronic promissory note (pagaré) and mutual agreement (mutuo) generation and signatures.
 */

import type {
  LegalContract,
  LegalServiceInterface,
  SignContractInput,
} from '@/types';
import { defaultMockStateStore, MockStateStore } from './mockState';

export class MockLegalService implements LegalServiceInterface {
  private store: MockStateStore;

  constructor(store: MockStateStore = defaultMockStateStore) {
    this.store = store;
  }

  public async generatePromissoryNote(loanId: string): Promise<LegalContract> {
    const loan = this.store.loans.find((l) => l.id === loanId);
    if (!loan) {
      throw new Error(`Loan not found: ${loanId}`);
    }

    const contract: LegalContract = {
      id: `contract-pagare-${Math.random().toString(36).substring(2, 9)}`,
      loan_id: loanId,
      document_type: 'pagare',
      document_url: `https://storage.lencord.ar/contracts/${loanId}/pagare-electronico.pdf`,
      signature_hash: null,
      signed_at: null,
    };

    this.store.contracts.push(contract);
    return JSON.parse(JSON.stringify(contract));
  }

  public async generateMutualAgreement(loanId: string): Promise<LegalContract> {
    const loan = this.store.loans.find((l) => l.id === loanId);
    if (!loan) {
      throw new Error(`Loan not found: ${loanId}`);
    }

    const contract: LegalContract = {
      id: `contract-mutuo-${Math.random().toString(36).substring(2, 9)}`,
      loan_id: loanId,
      document_type: 'mutuo',
      document_url: `https://storage.lencord.ar/contracts/${loanId}/contrato-mutuo.pdf`,
      signature_hash: null,
      signed_at: null,
    };

    this.store.contracts.push(contract);
    return JSON.parse(JSON.stringify(contract));
  }

  public async signContract(input: SignContractInput): Promise<LegalContract> {
    const contract = this.store.contracts.find((c) => c.id === input.contract_id);
    if (!contract) {
      throw new Error(`Contract not found: ${input.contract_id}`);
    }

    if (!input.signature_hash) {
      throw new Error('signature_hash is required to sign contract');
    }

    contract.signature_hash = input.signature_hash;
    contract.signed_at = new Date().toISOString();

    return JSON.parse(JSON.stringify(contract));
  }

  public async getContractsByLoan(loanId: string): Promise<LegalContract[]> {
    const contracts = this.store.contracts.filter((c) => c.loan_id === loanId);
    return JSON.parse(JSON.stringify(contracts));
  }

  public async getContractById(id: string): Promise<LegalContract | null> {
    const contract = this.store.contracts.find((c) => c.id === id);
    if (!contract) return null;
    return JSON.parse(JSON.stringify(contract));
  }
}

export const defaultMockLegalService = new MockLegalService();
