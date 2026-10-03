import { describe, expect, it } from 'vitest';
import {
  calculateFrenchMonthlyInstallment,
  generateFrenchInstallments,
} from '@/services/amortization';

describe('French Amortization System (Sistema de Amortización Francés)', () => {
  describe('calculateFrenchMonthlyInstallment', () => {
    it('returns 0 for non-positive principal or terms', () => {
      expect(calculateFrenchMonthlyInstallment(0, 12, 50)).toBe(0);
      expect(calculateFrenchMonthlyInstallment(-100, 12, 50)).toBe(0);
      expect(calculateFrenchMonthlyInstallment(1000000, 0, 50)).toBe(0);
    });

    it('calculates single term installment with one-month interest', () => {
      const principal = 1_000_000;
      const annualRate = 48; // 4% monthly
      const installment = calculateFrenchMonthlyInstallment(principal, 1, annualRate);
      expect(installment).toBe(1_040_000);
    });

    it('calculates constant installment for multi-month terms', () => {
      const principal = 10_000_000;
      const annualRate = 48; // 4% monthly
      const termMonths = 6;
      const installment = calculateFrenchMonthlyInstallment(principal, termMonths, annualRate);

      // A = 10,000,000 * [0.04 * (1.04)^6] / [(1.04)^6 - 1]
      // (1.04)^6 ≈ 1.265319
      // A ≈ 1,907,619.02
      expect(installment).toBeGreaterThan(1_900_000);
      expect(installment).toBeLessThan(1_920_000);
    });
  });

  describe('generateFrenchInstallments', () => {
    it('returns empty array when loan amount or term is 0 or negative', () => {
      expect(
        generateFrenchInstallments({
          loanId: 'loan-test',
          amount: 0,
          termMonths: 12,
          borrowerRate: 50,
          investorRate: 45,
        })
      ).toEqual([]);
    });

    it('generates exact number of installments matching termMonths', () => {
      const schedule = generateFrenchInstallments({
        loanId: 'loan-test-1',
        amount: 5_000_000,
        termMonths: 6,
        borrowerRate: 52,
        investorRate: 46,
      });

      expect(schedule).toHaveLength(6);
      expect(schedule[0].installment_number).toBe(1);
      expect(schedule[5].installment_number).toBe(6);
    });

    it('guarantees CONSTANT total investor installment (Cuota Total = Capital + Interés = constante)', () => {
      const schedule = generateFrenchInstallments({
        loanId: 'loan-test-constant',
        amount: 10_000_000,
        termMonths: 12,
        borrowerRate: 54,
        investorRate: 48,
      });

      // Calculate total investor installment for each month
      const investorMonthlyTotals = schedule.map(
        (inst) => inst.principal_amount + inst.interest_investors
      );

      const firstMonthTotal = investorMonthlyTotals[0];

      // Each month should equal the first month's total within rounding error (<= 0.05)
      investorMonthlyTotals.forEach((monthlyTotal, index) => {
        expect(
          Math.abs(monthlyTotal - firstMonthTotal),
          `Month ${index + 1} total (${monthlyTotal}) differs from month 1 (${firstMonthTotal})`
        ).toBeLessThanOrEqual(0.05);
      });
    });

    it('guarantees CONSTANT total borrower installment across all months', () => {
      const schedule = generateFrenchInstallments({
        loanId: 'loan-test-borrower-constant',
        amount: 8_000_000,
        termMonths: 6,
        borrowerRate: 50,
        investorRate: 44,
      });

      const borrowerMonthlyTotals = schedule.map(
        (inst) => inst.principal_amount + inst.interest_borrower
      );

      const firstMonthTotal = borrowerMonthlyTotals[0];

      borrowerMonthlyTotals.forEach((monthlyTotal, index) => {
        expect(
          Math.abs(monthlyTotal - firstMonthTotal),
          `Month ${index + 1} borrower total (${monthlyTotal}) differs from month 1 (${firstMonthTotal})`
        ).toBeLessThanOrEqual(0.05);
      });
    });

    it('guarantees decreasing interest and increasing principal (French system hallmark)', () => {
      const schedule = generateFrenchInstallments({
        loanId: 'loan-test-trend',
        amount: 12_000_000,
        termMonths: 6,
        borrowerRate: 48,
        investorRate: 42,
      });

      for (let i = 1; i < schedule.length; i++) {
        const prev = schedule[i - 1];
        const current = schedule[i];

        // Principal component must strictly increase each month
        expect(current.principal_amount).toBeGreaterThan(prev.principal_amount);

        // Interest component must strictly decrease each month
        expect(current.interest_investors).toBeLessThan(prev.interest_investors);
      }
    });

    it('amortizes 100% of the loan principal with exact sum matching amount', () => {
      const requestedAmount = 7_500_000;
      const schedule = generateFrenchInstallments({
        loanId: 'loan-test-amortized',
        amount: requestedAmount,
        termMonths: 12,
        borrowerRate: 52,
        investorRate: 45,
      });

      const totalPrincipalAmortized = schedule.reduce(
        (sum, inst) => sum + inst.principal_amount,
        0
      );

      expect(Math.abs(totalPrincipalAmortized - requestedAmount)).toBeLessThanOrEqual(0.05);
    });
  });
});
