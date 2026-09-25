import React from 'react';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ApplicationConfirmation } from '@/components/solicitar/ApplicationConfirmation';
import type { Loan } from '@/types';
import styles from '@/components/solicitar/solicitar.module.css';

export const metadata: Metadata = {
  title: 'Solicitud Confirmada | Lencord',
  description: 'Confirmación de solicitud de crédito PyME recibida y en proceso de revisión.',
};

export default async function ConfirmacionPage({
  searchParams,
}: {
  searchParams?: Promise<{
    loanId?: string;
    amount?: string;
    term?: string;
    category?: string;
    rateType?: string;
    legalName?: string;
    taxId?: string;
  }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const loanId = resolvedParams.loanId ?? 'loan-in-review';
  const amount = resolvedParams.amount ? parseInt(resolvedParams.amount, 10) : 5000000;
  const term = resolvedParams.term ? parseInt(resolvedParams.term, 10) : 6;
  const category = (resolvedParams.category ?? 'working_capital') as Loan['category'];
  const rateType = (resolvedParams.rateType ?? 'TNA_FIXED') as Loan['rate_type'];

  const fallbackLoan: Loan = {
    id: loanId,
    borrower_id: 'prof-sme-001',
    amount_requested: amount,
    amount_funded: 0,
    term_months: term,
    rate_type: rateType,
    investor_rate: 0,
    platform_spread: 0,
    borrower_rate: 0,
    base_uva_value: null,
    category,
    status: 'in_review',
    funding_deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
  };

  return (
    <>
      <Header />
      <main id="main-content">
        <div className={styles.container}>
          <ApplicationConfirmation
            loan={fallbackLoan}
            legalName={resolvedParams.legalName}
            taxId={resolvedParams.taxId}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
