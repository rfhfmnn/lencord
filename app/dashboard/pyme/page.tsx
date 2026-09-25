import React from 'react';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BorrowerDashboard } from '@/components/dashboard/BorrowerDashboard';

export const metadata: Metadata = {
  title: 'Panel PyME | Lencord',
  description:
    'Monitor de solicitud de crédito, progreso de subasta y cuadro de cuotas para PyMEs en Lencord.',
};

export default function BorrowerDashboardPage() {
  return (
    <>
      <Header />
      <main id="main-content">
        <BorrowerDashboard />
      </main>
      <Footer />
    </>
  );
}
