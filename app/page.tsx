import React from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import {
  HeroSimulator,
  TrustBar,
  HowItWorks,
  FinancingCategories,
} from '@/components/home';

export default function Home() {
  return (
    <>
      <Header />
      <main id="main-content">
        <HeroSimulator />
        <TrustBar />
        <HowItWorks />
        <FinancingCategories />
      </main>
      <Footer />
    </>
  );
}
