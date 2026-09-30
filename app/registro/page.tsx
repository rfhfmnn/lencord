import React from 'react';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { RegisterForm } from '@/components/auth';

export const metadata: Metadata = {
  title: 'Sumá tu PyME',
  description:
    'Sumá tu PyME y accedé a financiamiento colectivo para potenciar tu negocio.',
};

export default function RegistroPage() {
  return (
    <>
      <Header />
      <main id="main-content">
        <RegisterForm />
      </main>
      <Footer />
    </>
  );
}
