import React from 'react';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { FaqView } from '@/components/faq';

export const metadata: Metadata = {
  title: 'Preguntas frecuentes',
  description:
    'Resolvé tus dudas sobre financiamiento PyME e inversión colectiva en Lencord.',
};

export default function FaqPage() {
  return (
    <>
      <Header />
      <main id="main-content">
        <FaqView />
      </main>
      <Footer />
    </>
  );
}
