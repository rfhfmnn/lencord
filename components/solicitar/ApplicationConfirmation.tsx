'use client';

import React from 'react';
import Link from 'next/link';
import type { Loan } from '@/types';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/components/home/HeroSimulator';
import { LOAN_CATEGORY_LABELS } from '@/components/marketplace/LoanCard';
import styles from './solicitar.module.css';

export interface ApplicationConfirmationProps {
  loan: Loan;
  legalName?: string;
  taxId?: string;
}

export function ApplicationConfirmation({
  loan,
  legalName,
  taxId,
}: ApplicationConfirmationProps) {
  const categoryLabel = LOAN_CATEGORY_LABELS[loan.category] ?? loan.category;

  return (
    <div className={styles.confirmationCard} data-testid="application-confirmation">
      <div className={styles.confirmationIcon}>✓</div>

      <h2 className={styles.confirmationTitle}>¡Solicitud enviada con éxito!</h2>
      <p className={styles.confirmationSubtitle}>
        Tu pedido de financiamiento colectivo ha sido ingresado al circuito de análisis crediticio de Lencord.
      </p>

      <div className={styles.reviewTimeBanner} data-testid="review-time-banner">
        <span>⏱</span>
        <span>
          <strong>Plazo de evaluación:</strong> Nuestro equipo de análisis crediticio auditará la documentación y
          asignará el scoring definitivo dentro de las <strong>24 a 48 horas hábiles</strong>.
        </span>
      </div>

      <div className={styles.summaryReceipt}>
        <div className={styles.receiptTitle}>Resumen de la Solicitud</div>

        <div className={styles.receiptRow}>
          <span className={styles.receiptLabel}>Número de trámite / ID:</span>
          <span className={styles.receiptValue} style={{ fontFamily: 'monospace' }} data-testid="receipt-loan-id">
            {loan.id}
          </span>
        </div>

        <div className={styles.receiptRow}>
          <span className={styles.receiptLabel}>Estado actual:</span>
          <span
            className={styles.receiptValue}
            style={{
              color: '#0369a1',
              backgroundColor: '#e0f2fe',
              padding: '0.2rem 0.5rem',
              borderRadius: '9999px',
              fontSize: '0.8125rem',
              fontWeight: 700,
            }}
            data-testid="receipt-status"
          >
            En revisión (in_review)
          </span>
        </div>

        {legalName && (
          <div className={styles.receiptRow}>
            <span className={styles.receiptLabel}>Razón social:</span>
            <span className={styles.receiptValue} data-testid="receipt-legal-name">
              {legalName}
            </span>
          </div>
        )}

        {taxId && (
          <div className={styles.receiptRow}>
            <span className={styles.receiptLabel}>CUIT:</span>
            <span className={styles.receiptValue} data-testid="receipt-tax-id">
              {taxId}
            </span>
          </div>
        )}

        <div className={styles.receiptRow}>
          <span className={styles.receiptLabel}>Destino de fondos:</span>
          <span className={styles.receiptValue} data-testid="receipt-category">
            {categoryLabel}
          </span>
        </div>

        <div className={styles.receiptRow}>
          <span className={styles.receiptLabel}>Monto solicitado:</span>
          <span className={styles.receiptValue} data-testid="receipt-amount">
            {formatCurrency(loan.amount_requested)}
          </span>
        </div>

        <div className={styles.receiptRow}>
          <span className={styles.receiptLabel}>Plazo pretendido:</span>
          <span className={styles.receiptValue} data-testid="receipt-term">
            {loan.term_months} {loan.term_months === 1 ? 'mes' : 'meses'}
          </span>
        </div>

        <div className={styles.receiptRow}>
          <span className={styles.receiptLabel}>Esquema de tasa:</span>
          <span className={styles.receiptValue} data-testid="receipt-rate-type">
            {loan.rate_type === 'TNA_FIXED' ? 'Tasa Fija (TNA)' : 'CER + spread variable'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
        <Link href="/marketplace">
          <Button variant="bordered" size="md">
            Ver catálogo de préstamos
          </Button>
        </Link>
        <Link href="/">
          <Button variant="primary" size="md">
            Volver al inicio
          </Button>
        </Link>
      </div>
    </div>
  );
}
