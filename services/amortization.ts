/**
 * French Amortization System (Sistema de Amortización Francés)
 *
 * Characteristics:
 * - Constant total installments (Cuota Total = Capital + Interés = constante).
 * - Decreasing interest over time (calculated on outstanding balance).
 * - Increasing principal amortization over time.
 * - Symmetrical constant French installments for both the borrower and the investors,
 *   with a constant platform spread retained by Lencord.
 */

import type { Installment } from '@/types';

export interface FrenchScheduleInput {
  loanId: string;
  amount: number;
  termMonths: number;
  borrowerRate: number; // Annual percentage (e.g. 14.5 or 52.0)
  investorRate: number; // Annual percentage (e.g. 12.5 or 50.0)
  startDate?: Date;
  baseUvaValue?: number | null;
}

/**
 * Calculates the constant monthly installment for French amortization:
 * A = P * [ r*(1+r)^n / ((1+r)^n - 1) ]
 */
export function calculateFrenchMonthlyInstallment(
  principal: number,
  termMonths: number,
  annualRatePercent: number
): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  const monthlyRate = annualRatePercent > 0 ? annualRatePercent / 100 / 12 : 0.04;

  if (termMonths === 1) {
    return principal * (1 + monthlyRate);
  }

  const factor = Math.pow(1 + monthlyRate, termMonths);
  return (principal * (monthlyRate * factor)) / (factor - 1);
}

/**
 * Generates the full installment schedule conforming to the French amortization system.
 */
export function generateFrenchInstallments(input: FrenchScheduleInput): Installment[] {
  const {
    loanId,
    amount,
    termMonths,
    borrowerRate,
    investorRate,
    startDate = new Date(),
    baseUvaValue = null,
  } = input;

  if (amount <= 0 || termMonths <= 0) {
    return [];
  }

  const effectiveBorrowerRate = borrowerRate > 0 ? borrowerRate : 45.0;
  const effectiveInvestorRate = investorRate > 0 ? investorRate : Math.max(1, effectiveBorrowerRate - 2.5);

  const monthlyBorrowerRate = effectiveBorrowerRate / 100 / 12;
  const monthlyInvestorRate = effectiveInvestorRate / 100 / 12;

  const borrowerInstallmentTotal = calculateFrenchMonthlyInstallment(amount, termMonths, effectiveBorrowerRate);
  const investorInstallmentTotal = calculateFrenchMonthlyInstallment(amount, termMonths, effectiveInvestorRate);
  const lencordMonthlySpread = Math.max(0, borrowerInstallmentTotal - investorInstallmentTotal);

  let remainingPrincipal = amount;
  const schedule: Installment[] = [];

  for (let i = 1; i <= termMonths; i++) {
    const isLast = i === termMonths;
    const dueDate = new Date(startDate.getTime() + i * 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const interestInvestors = Number((remainingPrincipal * monthlyInvestorRate).toFixed(2));
    const principal = isLast
      ? Number(remainingPrincipal.toFixed(2))
      : Number((investorInstallmentTotal - interestInvestors).toFixed(2));

    remainingPrincipal = Math.max(0, remainingPrincipal - principal);

    const interestLencord = Number(lencordMonthlySpread.toFixed(2));
    const interestBorrower = Number((interestInvestors + interestLencord).toFixed(2));

    schedule.push({
      id: `inst-${Math.random().toString(36).substring(2, 9)}`,
      loan_id: loanId,
      installment_number: i,
      due_date: dueDate,
      principal_amount: principal,
      interest_borrower: interestBorrower,
      interest_investors: interestInvestors,
      interest_lencord: interestLencord,
      uva_value_applied: baseUvaValue,
      status: 'pending',
      paid_at: null,
    });
  }

  return schedule;
}
