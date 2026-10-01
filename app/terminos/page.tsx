import React from 'react';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { LegalPlaceholderView } from '@/components/legal';

export const metadata: Metadata = {
  title: 'Términos y Condiciones | Lencord',
  description:
    'Términos y condiciones de uso de la plataforma de financiamiento colectivo peer-to-peer Lencord.',
};

export default function TerminosPage() {
  return (
    <>
      <Header />
      <main id="main-content">
        <LegalPlaceholderView
          badge="Marco Legal"
          title="Términos y condiciones"
          subtitle="Bases y condiciones generales de uso de la plataforma Lencord para PyMEs e inversores."
          sectionTitle="Términos generales de uso de la plataforma"
          sectionDescription="Regulación de derechos, obligaciones, custodia de fondos y operatoria de financiamiento colaborativo conforme a la legislación aplicable en la República Argentina."
          placeholderTitle="Apartado en preparación"
          placeholderText="Los términos y condiciones de uso se encuentran en proceso de redacción y validación legal según las normativas vigentes en la República Argentina. Estarán disponibles próximamente."
          testId="terms-page-view"
        />
      </main>
      <Footer />
    </>
  );
}
