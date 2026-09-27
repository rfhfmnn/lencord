import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { LoginForm } from '@/components/auth';

export const metadata: Metadata = {
  title: 'Iniciar Sesión | Lencord',
  description:
    'Accedé a tu cuenta en Lencord para gestionar tus solicitudes de crédito PyME o tus inversiones colectivas.',
};

export default function LoginPage() {
  return (
    <>
      <Header />
      <main id="main-content">
        <Suspense fallback={<div style={{ minHeight: '60vh' }} />}>
          <LoginForm />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
