import React from 'react';
import styles from './trust-bar.module.css';

export interface TrustMetric {
  id: string;
  value: string;
  label: string;
  subtext: string;
}

export const TRUST_METRICS: TrustMetric[] = [
  {
    id: 'pymes-financed',
    value: '+150',
    label: 'PyMEs financiadas',
    subtext: 'En todo el territorio argentino',
  },
  {
    id: 'historical-volume',
    value: '$ 1.250M+',
    label: 'Volumen operado',
    subtext: 'Fondos canalizados a la producción',
  },
  {
    id: 'average-term',
    value: '5,8 meses',
    label: 'Plazo promedio',
    subtext: 'Amortización ágil y previsible',
  },
  {
    id: 'investor-return',
    value: '52,4% TNA',
    label: 'Rendimiento promedio',
    subtext: 'Retorno histórico últimos 6 meses',
  },
];

export interface TrustBarProps {
  metrics?: TrustMetric[];
  className?: string;
}

export function TrustBar({ metrics = TRUST_METRICS, className = '' }: TrustBarProps) {
  return (
    <section className={`${styles.trustBar} ${className}`} aria-label="Métricas de confianza">
      <div className={styles.container}>
        <div className={styles.metricsGrid}>
          {metrics.map((metric) => (
            <div key={metric.id} className={styles.metricCard} data-testid={`metric-${metric.id}`}>
              <span className={styles.metricValue}>{metric.value}</span>
              <span className={styles.metricLabel}>{metric.label}</span>
              <span className={styles.metricSubtext}>{metric.subtext}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
