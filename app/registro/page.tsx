import React from 'react';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { RegisterForm } from '@/components/auth';

export const metadata: Metadata = {
  title: 'Crear Cuenta | Lencord',
  description:
    'Registrate en Lencord como PyME para solicitar financiamiento colectivo o como inversor para rentabilizar tu capital.',
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
