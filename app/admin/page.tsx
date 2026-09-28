import React from 'react';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AdminConsole } from '@/components/admin/AdminConsole';

export const metadata: Metadata = {
  title: 'Mesa de crédito y aprobaciones',
  description:
    'Panel de administración para evaluación de riesgo crediticio, scoring y publicación de subastas.',
};

export default function AdminPage() {
  return (
    <>
      <Header />
      <main id="main-content">
        <AdminConsole />
      </main>
      <Footer />
    </>
  );
}
