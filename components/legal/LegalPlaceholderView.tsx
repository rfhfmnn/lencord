'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import styles from './legal-placeholder.module.css';

export interface LegalPlaceholderViewProps {
  badge: string;
  title: string;
  subtitle: string;
  sectionTitle: string;
  sectionDescription: string;
  placeholderTitle?: string;
  placeholderText: string;
  testId?: string;
}

export function LegalPlaceholderView({
  badge,
  title,
  subtitle,
  sectionTitle,
  sectionDescription,
  placeholderTitle = 'Apartado en preparación',
  placeholderText,
  testId = 'legal-placeholder-view',
}: LegalPlaceholderViewProps) {
  return (
    <div className={styles.legalWrapper} data-testid={testId}>
      {/* Header */}
      <header className={styles.legalHeader}>
        <span className={styles.badge}>{badge}</span>
        <h1 className={styles.pageTitle}>{title}</h1>
        <p className={styles.pageSubtitle}>{subtitle}</p>
      </header>

      {/* Main Section Card */}
      <section className={styles.sectionCard} aria-labelledby="legal-section-title">
        <div className={styles.sectionHeader}>
          <h2 id="legal-section-title" className={styles.sectionTitle}>
            {sectionTitle}
          </h2>
          <p className={styles.sectionDescription}>{sectionDescription}</p>
        </div>

        {/* Empty Placeholder Container */}
        <div className={styles.emptyPlaceholder} data-testid="legal-empty-placeholder">
          <div className={styles.placeholderIcon} aria-hidden="true">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className={styles.placeholderTitle}>{placeholderTitle}</h3>
          <p className={styles.placeholderText}>{placeholderText}</p>
        </div>
      </section>

      {/* Legal & Inquiries Support Banner */}
      <div className={styles.helpBanner} data-testid="legal-support-banner">
        <div className={styles.helpContent}>
          <h3 className={styles.helpTitle}>¿Tenés consultas legales o normativas?</h3>
          <p className={styles.helpText}>
            Nuestro equipo de legales y cumplimiento está a disposición para responder cualquier
            inquietud.
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
