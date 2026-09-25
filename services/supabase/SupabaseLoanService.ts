/**
 * Live Supabase Loan Service Implementation.
 * Conforms to LoanServiceInterface in _docs/plan.md Section 7 and @/types.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ApproveLoanInput,
  Installment,
  Loan,
  LoanFilters,
  LoanServiceInterface,
  SubmitLoanInput,
} from '@/types';
import { createSupabaseServerClient } from './client';
import { mapSupabaseError } from './errors';

export type SupabaseClientProvider =
  | SupabaseClient
  | (() => SupabaseClient | Promise<SupabaseClient>);

export class SupabaseLoanService implements LoanServiceInterface {
  private clientProvider?: SupabaseClientProvider;

  constructor(client?: SupabaseClientProvider) {
    this.clientProvider = client;
  }

  private async getClient(): Promise<SupabaseClient> {
    if (!this.clientProvider) {
      return createSupabaseServerClient();
    }
    if (typeof this.clientProvider === 'function') {
      return await this.clientProvider();
    }
    return this.clientProvider;
  }

  public async getLoanById(id: string): Promise<Loan | null> {
    try {
      const client = await this.getClient();
      const { data, error } = await client
        .from('loans')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw mapSupabaseError(error, `Error al obtener el préstamo ${id}`);
      }

      return data as Loan | null;
    } catch (err) {
      throw mapSupabaseError(err, `Error al obtener el préstamo ${id}`);
    }
  }

  public async listLoans(filters?: LoanFilters): Promise<Loan[]> {
    try {
      const client = await this.getClient();
      let query = client.from('loans').select('*');

      if (filters) {
        if (filters.status) {
          if (Array.isArray(filters.status)) {
            query = query.in('status', filters.status);
          } else {
            query = query.eq('status', filters.status);
          }
        }

        if (filters.borrower_id) {
          query = query.eq('borrower_id', filters.borrower_id);
        }

        if (filters.category) {
          query = query.eq('category', filters.category);
        }

        if (filters.rate_type) {
          query = query.eq('rate_type', filters.rate_type);
        }

        if (typeof filters.min_amount === 'number') {
          query = query.gte('amount_requested', filters.min_amount);
        }

        if (typeof filters.max_amount === 'number') {
          query = query.lte('amount_requested', filters.max_amount);
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw mapSupabaseError(error, 'Error al listar los préstamos');
      }

      let loans = (data || []) as Loan[];

      if (filters?.risk_tier) {
        const { data: profiles, error: pError } = await client
          .from('sme_credit_profiles')
          .select('profile_id, risk_tier')
          .eq('risk_tier', filters.risk_tier);

        if (!pError && profiles) {
          const eligibleBorrowerIds = new Set(profiles.map((p) => p.profile_id));
          loans = loans.filter((l) => eligibleBorrowerIds.has(l.borrower_id));
        }
      }

      return loans;
    } catch (err) {
      throw mapSupabaseError(err, 'Error al listar los préstamos');
    }
  }

  public async submitLoanApplication(input: SubmitLoanInput): Promise<Loan> {
    if (!input.borrower_id) {
      throw mapSupabaseError(new Error('borrower_id is required'));
    }
    if (input.amount_requested <= 0) {
      throw mapSupabaseError(new Error('check_amount_requested_positive'));
    }
    if (input.term_months <= 0) {
      throw mapSupabaseError(new Error('El plazo en meses debe ser mayor a cero'));
    }

    try {
      const client = await this.getClient();
      const now = new Date();
      const deadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const newLoanData = {
        borrower_id: input.borrower_id,
        amount_requested: input.amount_requested,
        amount_funded: 0,
        term_months: input.term_months,
        rate_type: input.rate_type,
        investor_rate: 0,
        platform_spread: 0,
        borrower_rate: 0,
        base_uva_value: null,
        category: input.category,
        status: 'in_review',
        funding_deadline: deadline.toISOString(),
      };

      const { data, error } = await client
        .from('loans')
        .insert(newLoanData)
        .select()
        .single();

      if (error) {
        throw mapSupabaseError(error, 'Error al registrar la solicitud de préstamo');
      }

      // Update supporting documents in credit profile if present
      if (input.balance_sheet_url || input.f931_url) {
        const updatePayload: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (input.balance_sheet_url) updatePayload.balance_sheet_url = input.balance_sheet_url;
        if (input.f931_url) updatePayload.f931_url = input.f931_url;

        await client
          .from('sme_credit_profiles')
          .update(updatePayload)
          .eq('profile_id', input.borrower_id);
      }

      return data as Loan;
    } catch (err) {
      throw mapSupabaseError(err, 'Error al registrar la solicitud de préstamo');
    }
  }

  public async approveAndPublishLoan(input: ApproveLoanInput): Promise<Loan> {
    try {
      const client = await this.getClient();
      const borrower_rate = Number((input.investor_rate + input.platform_spread).toFixed(2));

      const { data, error } = await client
        .from('loans')
        .update({
          investor_rate: input.investor_rate,
          platform_spread: input.platform_spread,
          borrower_rate,
          funding_deadline: input.funding_deadline,
          status: 'funding',
        })
        .eq('id', input.loan_id)
        .select()
        .single();

      if (error) {
        throw mapSupabaseError(error, `Error al aprobar y publicar el préstamo ${input.loan_id}`);
      }

      const updatedLoan = data as Loan;

      // Update risk tier on SME credit profile
      await client
        .from('sme_credit_profiles')
        .update({
          risk_tier: input.risk_tier,
          updated_at: new Date().toISOString(),
        })
        .eq('profile_id', updatedLoan.borrower_id);

      return updatedLoan;
    } catch (err) {
      throw mapSupabaseError(err, `Error al aprobar y publicar el préstamo ${input.loan_id}`);
    }
  }

  public async finalizeLoanFunding(loanId: string): Promise<Loan> {
    try {
      const client = await this.getClient();
      const loan = await this.getLoanById(loanId);
      if (!loan) {
        throw mapSupabaseError(new Error('Préstamo no encontrado'));
      }

      let newStatus = loan.status;
      if (loan.amount_funded >= loan.amount_requested) {
        newStatus = 'funded';
      } else {
        const isPastDeadline = new Date(loan.funding_deadline).getTime() <= Date.now();
        if (isPastDeadline) {
          newStatus = 'cancelled';
        }
      }

      if (newStatus !== loan.status) {
        const { data, error } = await client
          .from('loans')
          .update({ status: newStatus })
          .eq('id', loanId)
          .select()
          .single();

        if (error) {
          throw mapSupabaseError(error, `Error al finalizar fondeo del préstamo ${loanId}`);
        }
        return data as Loan;
      }

      return loan;
    } catch (err) {
      throw mapSupabaseError(err, `Error al finalizar fondeo del préstamo ${loanId}`);
    }
  }

  public async cancelLoan(loanId: string): Promise<Loan> {
    try {
      const client = await this.getClient();
      const { data, error } = await client
        .from('loans')
        .update({ status: 'cancelled' })
        .eq('id', loanId)
        .select()
        .single();

      if (error) {
        throw mapSupabaseError(error, `Error al cancelar el préstamo ${loanId}`);
      }

      return data as Loan;
    } catch (err) {
      throw mapSupabaseError(err, `Error al cancelar el préstamo ${loanId}`);
    }
  }

  public async getInstallmentsByLoan(loanId: string): Promise<Installment[]> {
    try {
      const client = await this.getClient();
      const { data, error } = await client
        .from('installments')
        .select('*')
        .eq('loan_id', loanId)
        .order('installment_number', { ascending: true });

      if (error) {
        throw mapSupabaseError(error, `Error al obtener cuotas del préstamo ${loanId}`);
      }

      return (data || []) as Installment[];
    } catch (err) {
      throw mapSupabaseError(err, `Error al obtener cuotas del préstamo ${loanId}`);
    }
  }
}
