import React from 'react';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { LoanDetail } from '@/components/marketplace';

export const metadata: Metadata = {
  title: 'Detalle de Oportunidad | Lencord Marketplace',
  description:
    'Detalle de la oportunidad de financiamiento colectivo para PyME argentina con scoring crediticio y rendimiento.',
};

export default async function LoanOpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <Header />
      <main id="main-content">
        <LoanDetail loanId={id} />
      </main>
      <Footer />
    </>
  );
}
