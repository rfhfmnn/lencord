import React from 'react';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { LegalPlaceholderView } from '@/components/legal';

export const metadata: Metadata = {
  title: 'Políticas de Privacidad | Lencord',
  description:
    'Políticas de privacidad y protección de datos personales de Lencord conforme a la Ley 25.326.',
};

export default function PrivacidadPage() {
  return (
    <>
      <Header />
      <main id="main-content">
        <LegalPlaceholderView
          badge="Protección de Datos"
          title="Políticas de privacidad"
          subtitle="Compromiso con el tratamiento seguro, confidencial y transparente de tus datos personales y societarios."
          sectionTitle="Tratamiento y protección de datos personales"
          sectionDescription="Cumplimiento de la Ley 25.326 de Protección de los Datos Personales, seguridad informática, cifrado y ejercicio de derechos de acceso, rectificación y supresión."
          placeholderTitle="Apartado en preparación"
          placeholderText="La política de privacidad y protección de datos personales se encuentra en proceso de redacción y adecuación a la Ley 25.326 y normativas aplicables. Estará disponible próximamente."
          testId="privacy-page-view"
        />
      </main>
      <Footer />
    </>
  );
}
