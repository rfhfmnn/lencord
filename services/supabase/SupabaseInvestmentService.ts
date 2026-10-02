/**
 * Live Supabase Investment Service Implementation.
 * Conforms to InvestmentServiceInterface in _docs/plan.md Section 7 & 8.3 and @/types.
 * Invokes PostgreSQL stored procedure commit_investment_atomic via supabase.rpc(...).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CommitInvestmentInput,
  CommitInvestmentResult,
  CustodyTransaction,
  EmailServiceInterface,
  Investment,
  InvestmentServiceInterface,
  Loan,
  PaymentGatewayInterface,
  RefundInvestmentsResult,
  RequestWithdrawalInput,
} from '@/types';
import { createSupabaseServerClient, createSupabaseBrowserClient } from './client';
import { mapSupabaseError } from './errors';
import type { SupabaseClientProvider } from './SupabaseLoanService';

export class SupabaseInvestmentService implements InvestmentServiceInterface {
  private clientProvider?: SupabaseClientProvider;
  private paymentGateway?: PaymentGatewayInterface;
  private emailService?: EmailServiceInterface;

  constructor(
    client?: SupabaseClientProvider,
    paymentGateway?: PaymentGatewayInterface,
    emailService?: EmailServiceInterface
  ) {
    this.clientProvider = client;
    this.paymentGateway = paymentGateway;
    this.emailService = emailService;
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

  public async commitInvestment(
    input: CommitInvestmentInput
  ): Promise<CommitInvestmentResult> {
    if (input.amount <= 0) {
      throw mapSupabaseError(
        new Error('Investment amount must be greater than zero')
      );
    }

    const client = await this.getClient();

    // Check investor tax_id requirement (Issue #53)
    const { data: profile } = await client
      .from('profiles')
      .select('tax_id')
      .eq('id', input.investor_id)
      .maybeSingle();

    if (profile && !profile.tax_id) {
      throw mapSupabaseError(
        new Error('MISSING_TAX_ID: Para poder invertir en esta PyME es necesario tener registrado tu DNI/CUIT en tu perfil.')
      );
    }

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

    let targetInvestorId = input.investor_id;
    if (!targetInvestorId || targetInvestorId === 'prof-inv-001') {
      try {
        const { data: authData } = await client.auth.getUser();
        if (authData?.user?.id) {
          targetInvestorId = authData.user.id;
        }
      } catch {
        // Fallback
      }
    }

    try {
      // 2. Invoke atomic PostgreSQL RPC procedure: commit_investment_atomic
      const { data, error } = await client.rpc('commit_investment_atomic', {
        p_loan_id: input.loan_id,
        p_investor_id: targetInvestorId,
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

  public async checkoutInvestment(
    input: import('@/types').CheckoutInvestmentInput
  ): Promise<import('@/types').CheckoutInvestmentResult> {
    if (input.amount <= 0) {
      throw mapSupabaseError(
        new Error('El monto a invertir debe ser mayor a cero')
      );
    }

    const client = await this.getClient();

    let targetInvestorId = input.investor_id;
    if (!targetInvestorId || targetInvestorId === 'prof-inv-001') {
      try {
        const { data: authData } = await client.auth.getUser();
        if (authData?.user?.id) {
          targetInvestorId = authData.user.id;
        }
      } catch {
        // Fallback
      }
    }

    // Check investor tax_id requirement (Issue #53)
    const { data: profile } = await client
      .from('profiles')
      .select('tax_id')
      .eq('id', targetInvestorId)
      .maybeSingle();

    if (profile && !profile.tax_id) {
      throw mapSupabaseError(
        new Error('MISSING_TAX_ID: Para poder invertir en esta PyME es necesario tener registrado tu DNI/CUIT en tu perfil.')
      );
    }

    const { data, error } = await client.rpc('process_investment_checkout_rpc', {
      p_loan_id: input.loan_id,
      p_investor_id: targetInvestorId,
      p_amount: input.amount,
      p_payment_method: input.payment_method,
      p_card_last_four: input.card_last_four || null,
      p_card_brand: input.card_brand || null,
    });

    if (error) {
      throw mapSupabaseError(error);
    }

    if (data && data.success === false) {
      throw mapSupabaseError(
        new Error(data.error_message || data.error || data.message || 'Error en la operación')
      );
    }

    return {
      success: Boolean(data?.success),
      investment_id: data?.investment_id,
      transaction_id: data?.transaction_id,
      amount_funded: Number(data?.amount_funded),
      loan_status: data?.loan_status,
      payment_method: input.payment_method,
      card_last_four: input.card_last_four,
      card_brand: input.card_brand,
      timestamp: new Date().toISOString(),
    };
  }

  public async getCustodyBalance(investorId: string): Promise<number> {
    try {
      const client = await this.getClient();
      const { data } = await client
        .from('custody_transactions')
        .select('balance_after')
        .eq('profile_id', investorId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && typeof data.balance_after === 'number') {
        return Number(data.balance_after);
      }
      const { data: prof } = await client
        .from('profiles')
        .select('custody_balance')
        .eq('id', investorId)
        .maybeSingle();
      return prof?.custody_balance ? Number(prof.custody_balance) : 0;
    } catch {
      return 0;
    }
  }

  public async getCustodyTransactions(investorId: string): Promise<CustodyTransaction[]> {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(investorId)) {
      return [];
    }
    try {
      const client = await this.getClient();
      const { data, error } = await client
        .from('custody_transactions')
        .select('*')
        .eq('profile_id', investorId)
        .order('created_at', { ascending: false });

      if (error) {
        throw mapSupabaseError(error, `Error al obtener transacciones de custodia`);
      }

      return (data || []) as CustodyTransaction[];
    } catch (err) {
      throw mapSupabaseError(err, `Error al obtener transacciones de custodia`);
    }
  }

  public async requestWithdrawal(input: RequestWithdrawalInput): Promise<CustodyTransaction> {
    if (!input.amount || input.amount <= 0) {
      throw new Error('El importe a retirar debe ser mayor a cero.');
    }

    const currentBalance = await this.getCustodyBalance(input.investor_id);
    if (input.amount > currentBalance) {
      throw new Error('Saldo insuficiente para realizar el retiro solicitado.');
    }

    const client = await this.getClient();
    const { data: profile } = await client
      .from('profiles')
      .select('bank_cbu_cvu, bank_alias')
      .eq('id', input.investor_id)
      .maybeSingle();

    const destinationCbu = input.bank_cbu_cvu || profile?.bank_cbu_cvu;
    if (!destinationCbu) {
      throw new Error('Cuenta bancaria no configurada. Por favor, agregá tu CBU/CVU en tu perfil.');
    }

    const newBalance = Number((currentBalance - input.amount).toFixed(2));

    const { data, error } = await client
      .from('custody_transactions')
      .insert({
        profile_id: input.investor_id,
        type: 'withdrawal',
        amount: input.amount,
        balance_after: newBalance,
        status: 'completed',
        payment_metadata: {
          bank_cbu_cvu: destinationCbu,
          bank_alias: input.bank_alias || profile?.bank_alias || null,
          description: 'Retiro de saldo en custodia a CBU bancario',
        },
      })
      .select()
      .single();

    if (error) {
      throw mapSupabaseError(error, 'Error al registrar la solicitud de retiro');
    }

    await client
      .from('profiles')
      .update({ custody_balance: newBalance })
      .eq('id', input.investor_id);

    return data as CustodyTransaction;
  }

  public async getInvestmentsByLoan(loanId: string): Promise<Investment[]> {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(loanId)) {
      return [];
    }

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
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(investorId)) {
      return [];
    }

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
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(id)) {
      return null;
    }
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
