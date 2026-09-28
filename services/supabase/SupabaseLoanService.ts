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
  PaymentGatewayInterface,
  SubmitLoanInput,
} from '@/types';
import { createSupabaseServerClient, createSupabaseBrowserClient } from './client';
import { mapSupabaseError } from './errors';

export type SupabaseClientProvider =
  | SupabaseClient
  | (() => SupabaseClient | Promise<SupabaseClient>);

export class SupabaseLoanService implements LoanServiceInterface {
  private clientProvider?: SupabaseClientProvider;
  private paymentGateway?: PaymentGatewayInterface;

  constructor(
    client?: SupabaseClientProvider,
    paymentGateway?: PaymentGatewayInterface
  ) {
    this.clientProvider = client;
    this.paymentGateway = paymentGateway;
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

  public async expireLoan(loanId: string): Promise<Loan> {
    try {
      const client = await this.getClient();
      const { data, error } = await client
        .from('loans')
        .update({ status: 'expired' })
        .eq('id', loanId)
        .select()
        .single();

      if (error) {
        throw mapSupabaseError(error, `Error al marcar expirado el préstamo ${loanId}`);
      }

      return data as Loan;
    } catch (err) {
      throw mapSupabaseError(err, `Error al marcar expirado el préstamo ${loanId}`);
    }
  }

  public async flagPartialAcceptance(loanId: string, deadline: string): Promise<Loan> {
    try {
      const client = await this.getClient();
      const { data, error } = await client
        .from('loans')
        .update({
          partial_acceptance_flag: true,
          partial_acceptance_deadline: deadline,
          notification_dispatched: true,
        })
        .eq('id', loanId)
        .select()
        .single();

      if (error) {
        throw mapSupabaseError(error, `Error al marcar aceptación parcial del préstamo ${loanId}`);
      }

      return data as Loan;
    } catch (err) {
      throw mapSupabaseError(err, `Error al marcar aceptación parcial del préstamo ${loanId}`);
    }
  }

  public async rejectLoan(loanId: string, reason: string): Promise<Loan> {
    try {
      const client = await this.getClient();
      let updatePayload: Record<string, any> = { status: 'rejected' };
      if (reason) {
        updatePayload.rejection_reason = reason;
      }

      let res = await client
        .from('loans')
        .update(updatePayload)
        .eq('id', loanId)
        .select()
        .single();

      if (res.error && res.error.message?.includes('rejection_reason')) {
        res = await client
          .from('loans')
          .update({ status: 'rejected' })
          .eq('id', loanId)
          .select()
          .single();
      }

      if (res.error) {
        throw mapSupabaseError(res.error, `Error al rechazar el préstamo ${loanId}`);
      }

      return res.data as Loan;
    } catch (err) {
      throw mapSupabaseError(err, `Error al rechazar el préstamo ${loanId}`);
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

  public async activateLoan(loanId: string): Promise<Loan> {
    try {
      const client = await this.getClient();

      // 1. Fetch target loan
      const { data: loanData, error: fetchErr } = await client
        .from('loans')
        .select('*')
        .eq('id', loanId)
        .single();

      if (fetchErr || !loanData) {
        throw mapSupabaseError(fetchErr, `Préstamo no encontrado: ${loanId}`);
      }

      const loan = loanData as Loan;

      // 2. Update status to active
      const { data: updatedLoan, error: updateErr } = await client
        .from('loans')
        .update({ status: 'active' })
        .eq('id', loanId)
        .select()
        .single();

      if (updateErr) {
        throw mapSupabaseError(updateErr, `Error al activar el préstamo ${loanId}`);
      }

      // 3. Trigger loan disbursement via payment gateway
      if (this.paymentGateway) {
        const { data: profile } = await client
          .from('profiles')
          .select('bank_cbu_cvu')
          .eq('id', loan.borrower_id)
          .maybeSingle();

        const cbu = profile?.bank_cbu_cvu || '0000003100010000000001';
        await this.paymentGateway.disburseLoan(loan.id, cbu, loan.amount_requested).catch(() => {});
      }

      // 4. Generate monthly rows in installments table
      const { data: existingInst } = await client
        .from('installments')
        .select('id')
        .eq('loan_id', loanId);

      if (!existingInst || existingInst.length === 0) {
        const term = loan.term_months || 1;
        const annualRate = loan.borrower_rate || 45;
        const monthlyRate = annualRate > 0 ? annualRate / 100 / 12 : 0.04;
        let installmentAmount = 0;
        if (term === 1) {
          installmentAmount = loan.amount_requested * (1 + monthlyRate);
        } else {
          const factor = Math.pow(1 + monthlyRate, term);
          installmentAmount = (loan.amount_requested * (monthlyRate * factor)) / (factor - 1);
        }

        let remaining = loan.amount_requested;
        const now = new Date();
        const investorRateRatio = loan.borrower_rate > 0 ? loan.investor_rate / loan.borrower_rate : 0.9;
        const rows = [];

        for (let i = 1; i <= term; i++) {
          const interestTotal = remaining * monthlyRate;
          const principal = installmentAmount - interestTotal;
          remaining = Math.max(0, remaining - principal);
          const dueDate = new Date(now.getTime() + i * 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];

          const interestInvestors = Number((interestTotal * investorRateRatio).toFixed(2));
          const interestLencord = Number((interestTotal - interestInvestors).toFixed(2));

          rows.push({
            loan_id: loan.id,
            installment_number: i,
            due_date: dueDate,
            principal_amount: Number(principal.toFixed(2)),
            interest_borrower: Number(interestTotal.toFixed(2)),
            interest_investors: interestInvestors,
            interest_lencord: interestLencord,
            uva_value_applied: loan.base_uva_value,
            status: 'pending',
          });
        }

        await client.from('installments').insert(rows);
      }

      return updatedLoan as Loan;
    } catch (err) {
      throw mapSupabaseError(err, `Error al activar préstamo ${loanId}`);
    }
  }
}
