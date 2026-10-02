import React from 'react';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { LoanWizard } from '@/components/solicitar';

export const metadata: Metadata = {
  title: 'Solicitar financiamiento',
  description:
    'Solicitud de préstamo online en Lencord.',
};

export default function SolicitarPage() {
  return (
    <>
      <Header />
      <main id="main-content">
        <LoanWizard redirectToConfirmationPage={true} />
      </main>
      <Footer />
    </>
  );
}
