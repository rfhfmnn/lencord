'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import styles from './faq.module.css';

export type FaqTabId = 'general' | 'pymes' | 'inversores';

interface FaqTabConfig {
  id: FaqTabId;
  label: string;
  sectionTitle: string;
  sectionDescription: string;
  placeholderText: string;
}

const FAQ_TABS: FaqTabConfig[] = [
  {
    id: 'general',
    label: 'General',
    sectionTitle: 'Preguntas generales sobre Lencord',
    sectionDescription:
      'Información institucional sobre cómo funciona la plataforma, marco normativo, modelo tecnológico y custodia segura de fondos.',
    placeholderText:
      'Estamos compilando las preguntas más frecuentes sobre el funcionamiento general de la plataforma. Muy pronto vas a encontrar aquí las respuestas a todas tus consultas.',
  },
  {
    id: 'pymes',
    label: 'Para PyMEs',
    sectionTitle: 'Financiamiento colectivo para PyMEs',
    sectionDescription:
      'Requisitos para solicitar crédito, documentación contable solicitada, evaluación de scoring crediticio, proceso de subasta y pagos mensuales.',
    placeholderText:
      'Las preguntas frecuentes para empresas y PyMEs que buscan financiamiento están en proceso de redacción y estarán publicadas en breve.',
  },
  {
    id: 'inversores',
    label: 'Para inversores',
    sectionTitle: 'Inversión y rendimientos para inversores',
    sectionDescription:
      'Cómo participar en subastas de crédito, esquemas de tasas (fija TNA o UVA+spread), custodia de saldos bancarios y acreditación automática de cobranzas.',
    placeholderText:
      'El apartado de preguntas frecuentes para inversores individuales e institucionales está siendo preparado y estará disponible próximamente.',
  },
];

export function FaqView() {
  const [activeTab, setActiveTab] = useState<FaqTabId>('general');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextIndex = (index + 1) % FAQ_TABS.length;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIndex = (index - 1 + FAQ_TABS.length) % FAQ_TABS.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = FAQ_TABS.length - 1;
    }

    if (nextIndex !== index) {
      const nextTab = FAQ_TABS[nextIndex];
      setActiveTab(nextTab.id);
      tabRefs.current[nextIndex]?.focus();
    }
  };

  const currentTab = FAQ_TABS.find((t) => t.id === activeTab) || FAQ_TABS[0];

  return (
    <div className={styles.faqWrapper} data-testid="faq-view">
      {/* Header */}
      <header className={styles.faqHeader}>
        <span className={styles.badge}>Centro de ayuda</span>
        <h1 className={styles.pageTitle}>Preguntas frecuentes</h1>
        <p className={styles.pageSubtitle}>
          Encontrá respuestas rápidas sobre cómo operar en Lencord, ya sea para financiar tu empresa
          o para rentabilizar tu capital invirtiendo en economía real.
        </p>
      </header>

      {/* Accessible Tabs (WAI-ARIA) */}
      <div
        role="tablist"
        aria-label="Apartados de preguntas frecuentes"
        className={styles.tabList}
      >
        {FAQ_TABS.map((tab, index) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`${styles.tabButton} ${isActive ? styles.tabButtonActive : ''}`}
              data-testid={`faq-tab-${tab.id}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panel */}
      <div
        role="tabpanel"
        id={`panel-${currentTab.id}`}
        aria-labelledby={`tab-${currentTab.id}`}
        tabIndex={0}
        className={styles.tabPanel}
        data-testid={`faq-panel-${currentTab.id}`}
      >
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{currentTab.sectionTitle}</h2>
            <p className={styles.sectionDescription}>{currentTab.sectionDescription}</p>
          </div>

          {/* Placeholder ready for upcoming Q&As */}
          <div className={styles.emptyPlaceholder} data-testid="faq-empty-placeholder">
            <div className={styles.placeholderIcon} aria-hidden="true">
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className={styles.placeholderTitle}>Apartado en preparación</h3>
            <p className={styles.placeholderText}>{currentTab.placeholderText}</p>
          </div>
        </section>
      </div>

      {/* Support CTA Banner */}
      <div className={styles.helpBanner} data-testid="faq-support-banner">
        <div className={styles.helpContent}>
          <h3 className={styles.helpTitle}>¿Tenés una consulta específica?</h3>
          <p className={styles.helpText}>
            Nuestro equipo de operaciones y riesgo está a tu disposición para asesorarte.
          </p>
        </div>
        <Link href="mailto:soporte@lencord.com">
          <Button variant="primary" size="md">
            Contactar a soporte
          </Button>
        </Link>
      </div>
    </div>
  );
}
