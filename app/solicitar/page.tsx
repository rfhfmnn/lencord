import React from 'react';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { LoanWizard } from '@/components/solicitar';

export const metadata: Metadata = {
  title: 'Solicitar financiamiento',
  description:
    'Formulario de solicitud de crédito online en Lencord. Financiamiento colectivo con condiciones a tu medida.',
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
