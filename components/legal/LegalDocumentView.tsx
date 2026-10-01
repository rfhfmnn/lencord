'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import styles from './legal-document.module.css';

export interface LegalClause {
  id?: string;
  number?: string;
  title: string;
  content: React.ReactNode;
}

export interface LegalRiskWarning {
  title: string;
  description?: string;
  points?: string[];
  content?: React.ReactNode;
}

export interface LegalDocumentViewProps {
  badge: string;
  title: string;
  subtitle: string;
  lastUpdated?: string;
  riskWarning?: LegalRiskWarning;
  clauses?: LegalClause[];
  sections?: LegalClause[];
  testId?: string;
}

export function LegalDocumentView({
  badge,
  title,
  subtitle,
  lastUpdated,
  riskWarning,
  clauses,
  sections,
  testId = 'legal-document-view',
}: LegalDocumentViewProps) {
  const items = clauses || sections || [];

  return (
    <div className={styles.wrapper} data-testid={testId}>
      {/* Page Header */}
      <header className={styles.header}>
        <span className={styles.badge}>{badge}</span>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
        {lastUpdated && (
          <p className={styles.lastUpdated} data-testid="last-updated-text">
            Última actualización: {lastUpdated}
          </p>
        )}
      </header>

      {/* Featured Risk Warning Banner if present */}
      {riskWarning && (
        <section
          className={styles.riskBanner}
          role="region"
          aria-label="Advertencia de Riesgo"
          data-testid="risk-warning-banner"
        >
          <h2 className={styles.riskTitle}>
            <span>⚠️</span>
            <span>{riskWarning.title}</span>
          </h2>
          <div className={styles.riskText} data-testid="risk-warning-text">
            {riskWarning.description && <p>{riskWarning.description}</p>}
            {riskWarning.points && riskWarning.points.length > 0 && (
              <ul>
                {riskWarning.points.map((pt, pIdx) => (
                  <li key={pIdx}>{pt}</li>
                ))}
              </ul>
            )}
            {riskWarning.content}
          </div>
        </section>
      )}

      {/* Structured Legal Clauses */}
      <div className={styles.sectionsList} data-testid="legal-clauses-container">
        {items.map((clause, idx) => (
          <article
            key={clause.id || idx}
            className={styles.clauseCard}
            aria-labelledby={`clause-title-${idx}`}
            data-testid={`legal-clause-${idx}`}
          >
            <span className={styles.clauseNumber}>
              {clause.number || `Cláusula ${idx + 1}`}
            </span>
            <h2 id={`clause-title-${idx}`} className={styles.clauseTitle}>
              {clause.title}
            </h2>
            <div className={styles.clauseBody}>{clause.content}</div>
          </article>
        ))}
      </div>

      {/* Legal & Inquiries Support Banner */}
      <div className={styles.helpBanner} data-testid="legal-support-banner">
        <div className={styles.helpContent}>
          <h3 className={styles.helpTitle}>¿Tenés consultas legales o normativas?</h3>
          <p className={styles.helpText}>
            Nuestro equipo de legales y cumplimiento está a disposición para responder cualquier
            inquietud respecto a los contratos, mandatos o tratamiento de información.
          </p>
        </div>
        <Link href="mailto:legales@lencord.com">
          <Button variant="primary" size="md">
            Contactar a legales
          </Button>
        </Link>
      </div>
    </div>
  );
}

export type LegalDocumentSection = LegalClause;
