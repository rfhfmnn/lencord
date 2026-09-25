import React from 'react';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MarketplaceCatalog } from '@/components/marketplace';

export const metadata: Metadata = {
  title: 'Marketplace de Préstamos | Lencord',
  description:
    'Catálogo público de oportunidades de financiamiento colectivo para PyMEs argentinas.',
};

export default function MarketplacePage() {
  return (
    <>
      <Header />
      <main id="main-content">
        <MarketplaceCatalog />
      </main>
      <Footer />
    </>
  );
}
