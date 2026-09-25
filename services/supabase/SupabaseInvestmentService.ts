/**
 * Live Supabase Investment Service Implementation.
 * Conforms to InvestmentServiceInterface in _docs/plan.md Section 7 & 8.3 and @/types.
 * Invokes PostgreSQL stored procedure commit_investment_atomic via supabase.rpc(...).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CommitInvestmentInput,
  CommitInvestmentResult,
  Investment,
  InvestmentServiceInterface,
  Loan,
  PaymentGatewayInterface,
  RefundInvestmentsResult,
} from '@/types';
import { createSupabaseServerClient } from './client';
import { mapSupabaseError } from './errors';
import type { SupabaseClientProvider } from './SupabaseLoanService';

export class SupabaseInvestmentService implements InvestmentServiceInterface {
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
      return createSupabaseServerClient();
    }
    if (typeof this.clientProvider === 'function') {
      return await this.clientProvider();
    }
    return this.clientProvider;
  }

  public async commitInvestment(
    input: CommitInvestmentInput
  ): Promise<CommitInvestmentResult> {
    if (input.amount <= 0) {
      throw mapSupabaseError(
        new Error('Investment amount must be greater than zero')
      );
    }

    const client = await this.getClient();

    // 1. Hold funds via Payment Gateway if configured
    let holdId: string | null = null;
    if (this.paymentGateway) {
      const holdResult = await this.paymentGateway.holdFunds(
        input.investor_id,
        input.amount,
        input.loan_id
      );
      if (!holdResult.success) {
        throw mapSupabaseError(
          new Error('Payment gateway failed to hold funds for investment')
        );
      }
      holdId = holdResult.holdId;
    }

    try {
      // 2. Invoke atomic PostgreSQL RPC procedure: commit_investment_atomic
      const { data, error } = await client.rpc('commit_investment_atomic', {
        p_loan_id: input.loan_id,
        p_investor_id: input.investor_id,
        p_amount: input.amount,
      });

      if (error) {
        // If RPC failed after holding funds, rollback hold
        if (this.paymentGateway && holdId) {
          await this.paymentGateway.releaseFunds(holdId).catch(() => {});
        }
        throw mapSupabaseError(
          error,
          'Error al procesar la inversión en la subasta'
        );
      }

      // If holdId exists, update the newly created investment row with external_payment_id
      if (holdId) {
        await client
          .from('investments')
          .update({ external_payment_id: holdId })
          .eq('loan_id', input.loan_id)
          .eq('investor_id', input.investor_id)
          .eq('status', 'committed')
          .order('created_at', { ascending: false })
          .limit(1);
      }

      // 3. Fetch latest loan state
      const { data: loanData, error: loanError } = await client
        .from('loans')
        .select('*')
        .eq('id', input.loan_id)
        .single();

      if (loanError || !loanData) {
        throw mapSupabaseError(
          loanError,
          `Error al recuperar estado actualizado del préstamo ${input.loan_id}`
        );
      }

      const updatedLoan = loanData as Loan;

      // 4. Fetch the created investment record
      const { data: invData } = await client
        .from('investments')
        .select('*')
        .eq('loan_id', input.loan_id)
        .eq('investor_id', input.investor_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const investment: Investment = invData || {
        id: `inv-${Date.now()}`,
        loan_id: input.loan_id,
        investor_id: input.investor_id,
        amount: input.amount,
        status: 'committed',
        external_payment_id: holdId,
        created_at: new Date().toISOString(),
      };

      return {
        investment,
        loan: updatedLoan,
        amount_funded: updatedLoan.amount_funded,
        is_fully_funded: updatedLoan.status === 'funded',
      };
    } catch (err) {
      if (this.paymentGateway && holdId) {
        await this.paymentGateway.releaseFunds(holdId).catch(() => {});
      }
      throw mapSupabaseError(
        err,
        'Error al procesar la inversión en la subasta'
      );
    }
  }

  public async getInvestmentsByLoan(loanId: string): Promise<Investment[]> {
    try {
      const client = await this.getClient();
      const { data, error } = await client
        .from('investments')
        .select('*')
        .eq('loan_id', loanId)
        .order('created_at', { ascending: false });

      if (error) {
        throw mapSupabaseError(error, `Error al obtener inversiones del préstamo ${loanId}`);
      }

      return (data || []) as Investment[];
    } catch (err) {
      throw mapSupabaseError(err, `Error al obtener inversiones del préstamo ${loanId}`);
    }
  }

  public async getInvestmentsByInvestor(investorId: string): Promise<Investment[]> {
    try {
      const client = await this.getClient();
      const { data, error } = await client
        .from('investments')
        .select('*')
        .eq('investor_id', investorId)
        .order('created_at', { ascending: false });

      if (error) {
        throw mapSupabaseError(
          error,
          `Error al obtener inversiones del inversor ${investorId}`
        );
      }

      return (data || []) as Investment[];
    } catch (err) {
      throw mapSupabaseError(
        err,
        `Error al obtener inversiones del inversor ${investorId}`
      );
    }
  }

  public async getInvestmentById(id: string): Promise<Investment | null> {
    try {
      const client = await this.getClient();
      const { data, error } = await client
        .from('investments')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw mapSupabaseError(error, `Error al obtener la inversión ${id}`);
      }

      return data as Investment | null;
    } catch (err) {
      throw mapSupabaseError(err, `Error al obtener la inversión ${id}`);
    }
  }

  public async refundInvestmentsByLoan(
    loanId: string
  ): Promise<RefundInvestmentsResult> {
    try {
      const client = await this.getClient();
      const { data: committed, error } = await client
        .from('investments')
        .select('*')
        .eq('loan_id', loanId)
        .eq('status', 'committed');

      if (error) {
        throw mapSupabaseError(error, `Error al listar inversiones a reembolsar`);
      }

      const investments = (committed || []) as Investment[];
      let refundedCount = 0;
      let totalRefundedAmount = 0;

      for (const inv of investments) {
        await client
          .from('investments')
          .update({ status: 'refunded' })
          .eq('id', inv.id);

        refundedCount += 1;
        totalRefundedAmount += inv.amount;

        if (this.paymentGateway && inv.external_payment_id) {
          await this.paymentGateway.releaseFunds(inv.external_payment_id).catch(() => {});
        }
      }

      return {
        refunded_count: refundedCount,
        total_refunded_amount: totalRefundedAmount,
      };
    } catch (err) {
      throw mapSupabaseError(err, `Error al reembolsar inversiones del préstamo ${loanId}`);
    }
  }
}
