/**
 * Live Supabase Legal Service Implementation.
 * Conforms to LegalServiceInterface in _docs/plan.md Section 7 & 6 and @/types.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  LegalContract,
  LegalServiceInterface,
  SignContractInput,
} from '@/types';
import { createSupabaseServerClient, createSupabaseBrowserClient } from './client';
import { mapSupabaseError } from './errors';
import type { SupabaseClientProvider } from './SupabaseLoanService';

export class SupabaseLegalService implements LegalServiceInterface {
  private clientProvider?: SupabaseClientProvider;

  constructor(client?: SupabaseClientProvider) {
    this.clientProvider = client;
  }

  private async getClient(): Promise<SupabaseClient> {
    if (!this.clientProvider) {
      if (typeof window !== 'undefined') {
        return createSupabaseBrowserClient();
      }
      return createSupabaseServerClient();
    }
    if (typeof this.clientProvider === 'function') {
      return await this.clientProvider();
    }
    return this.clientProvider;
  }

  public async generatePromissoryNote(loanId: string): Promise<LegalContract> {
    try {
      const client = await this.getClient();
      const contractData = {
        loan_id: loanId,
        document_type: 'pagare',
        document_url: `/contracts/${loanId}/pagare-electronico.pdf`,
        signature_hash: null,
        signed_at: null,
      };

      const { data, error } = await client
        .from('legal_contracts')
        .insert(contractData)
        .select()
        .single();

      if (error) {
        throw mapSupabaseError(error, `Error al generar pagaré para el préstamo ${loanId}`);
      }

      return data as LegalContract;
    } catch (err) {
      throw mapSupabaseError(err, `Error al generar pagaré para el préstamo ${loanId}`);
    }
  }

  public async generateMutualAgreement(loanId: string): Promise<LegalContract> {
    try {
      const client = await this.getClient();
      const contractData = {
        loan_id: loanId,
        document_type: 'mutuo',
        document_url: `/contracts/${loanId}/contrato-mutuo.pdf`,
        signature_hash: null,
        signed_at: null,
      };

      const { data, error } = await client
        .from('legal_contracts')
        .insert(contractData)
        .select()
        .single();

      if (error) {
        throw mapSupabaseError(error, `Error al generar mutuo para el préstamo ${loanId}`);
      }

      return data as LegalContract;
    } catch (err) {
      throw mapSupabaseError(err, `Error al generar mutuo para el préstamo ${loanId}`);
    }
  }

  public async signContract(input: SignContractInput): Promise<LegalContract> {
    if (!input.signature_hash) {
      throw mapSupabaseError(new Error('signature_hash is required to sign contract'));
    }

    try {
      const client = await this.getClient();
      const now = new Date().toISOString();

      const updatePayload: Record<string, any> = {
        signature_hash: input.signature_hash,
        signed_at: now,
      };

      if (input.signer_id !== undefined) updatePayload.signer_id = input.signer_id;
      if (input.signer_role !== undefined) updatePayload.signer_role = input.signer_role;
      if (input.signer_ip !== undefined) updatePayload.signer_ip = input.signer_ip;
      if (input.signer_user_agent !== undefined) updatePayload.signer_user_agent = input.signer_user_agent;

      const { data, error } = await client
        .from('legal_contracts')
        .update(updatePayload)
        .eq('id', input.contract_id)
        .select()
        .single();

      if (error) {
        throw mapSupabaseError(error, `Error al firmar contrato ${input.contract_id}`);
      }

      return data as LegalContract;
    } catch (err) {
      throw mapSupabaseError(err, `Error al firmar contrato ${input.contract_id}`);
    }
  }

  public async getContractsByLoan(loanId: string): Promise<LegalContract[]> {
    try {
      const client = await this.getClient();
      const { data, error } = await client
        .from('legal_contracts')
        .select('*')
        .eq('loan_id', loanId);

      if (error) {
        throw mapSupabaseError(error, `Error al obtener contratos del préstamo ${loanId}`);
      }

      return (data || []) as LegalContract[];
    } catch (err) {
      throw mapSupabaseError(err, `Error al obtener contratos del préstamo ${loanId}`);
    }
  }

  public async getContractById(id: string): Promise<LegalContract | null> {
    try {
      const client = await this.getClient();
      const { data, error } = await client
        .from('legal_contracts')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw mapSupabaseError(error, `Error al obtener contrato ${id}`);
      }

      return data as LegalContract | null;
    } catch (err) {
      throw mapSupabaseError(err, `Error al obtener contrato ${id}`);
    }
  }
}
