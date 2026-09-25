import React from 'react';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { InvestorDashboard } from '@/components/dashboard/InvestorDashboard';

export const metadata: Metadata = {
  title: 'Panel del Inversor | Lencord',
  description:
    'Tablero de control de inversiones, rendimientos y cronograma de cobros para inversores en Lencord.',
};

export default function InvestorDashboardPage() {
  return (
    <>
      <Header />
      <main id="main-content">
        <InvestorDashboard />
      </main>
      <Footer />
    </>
  );
}
