'use client';

import React, { useState } from 'react';
import styles from './how-it-works.module.css';

export type UserAudience = 'pymes' | 'inversores';

export interface WorkflowStep {
  stepNumber: number;
  title: string;
  description: string;
}

export const PYME_STEPS: WorkflowStep[] = [
  {
    stepNumber: 1,
    title: 'Solicitud online',
    description: 'Completá los datos de tu empresa y el destino de los fondos en pocos minutos.',
  },
  {
    stepNumber: 2,
    title: 'Evaluación 24h',
    description: 'Validamos tu situación fiscal y crediticia con la Central de Deudores del BCRA sin demoras.',
  },
  {
    stepNumber: 3,
    title: 'Publicación en subasta',
    description: 'Tu solicitud calificada se publica en el marketplace para ser fondeada colectivamente.',
  },
  {
    stepNumber: 4,
    title: 'Desembolso directo',
    description: 'Recibí el capital directo en tu CBU/CVU bancario al completarse la subasta y firmar el pagaré digital.',
  },
];

export const INVESTOR_STEPS: WorkflowStep[] = [
  {
    stepNumber: 1,
    title: 'Creá tu cuenta',
    description: 'Registro ágil con verificación de identidad (KYC) y vinculación de cuenta bancaria.',
  },
  {
    stepNumber: 2,
    title: 'Elegí oportunidades',
    description: 'Evaluá solicitudes analizadas y clasificadas por plazo, tasa y semáforo de riesgo (Tier A, B, C).',
  },
  {
    stepNumber: 3,
    title: 'Invertí en cuotas',
    description: 'Participá en subastas transparentes con tickets accesibles desde $10.000.',
  },
  {
    stepNumber: 4,
    title: 'Cobrá mes a mes',
    description: 'Recibí las cuotas de amortización e interés directo en tu cuenta según el cronograma fijado.',
  },
];

export interface HowItWorksProps {
  initialAudience?: UserAudience;
  className?: string;
}

export function HowItWorks({ initialAudience = 'pymes', className = '' }: HowItWorksProps) {
  const [audience, setAudience] = useState<UserAudience>(initialAudience);

  const steps = audience === 'pymes' ? PYME_STEPS : INVESTOR_STEPS;

  return (
    <section id="como-funciona" className={`${styles.section} ${className}`} aria-label="Cómo funciona Lencord">
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Cómo funciona</h2>
          <p className={styles.subtitle}>
            Un proceso ágil, transparente y seguro tanto para PyMEs en búsqueda de liquidez como para inversores.
          </p>

          {/* Interactive Audience Tabs */}
          <div className={styles.tabList} role="tablist" aria-label="Audiencia de proceso">
            <button
              type="button"
              role="tab"
              id="tab-pymes"
              aria-selected={audience === 'pymes'}
              aria-controls="panel-pymes"
              className={`${styles.tabButton} ${audience === 'pymes' ? styles.tabButtonActive : ''}`}
              onClick={() => setAudience('pymes')}
              data-testid="tab-pymes-btn"
            >
              Para PyMEs
            </button>
            <button
              type="button"
              role="tab"
              id="tab-inversores"
              aria-selected={audience === 'inversores'}
              aria-controls="panel-inversores"
              className={`${styles.tabButton} ${audience === 'inversores' ? styles.tabButtonActive : ''}`}
              onClick={() => setAudience('inversores')}
              data-testid="tab-inversores-btn"
            >
              Para Inversores
            </button>
          </div>
        </div>

        {/* Steps Grid */}
        <div
          id={`panel-${audience}`}
          role="tabpanel"
          aria-labelledby={`tab-${audience}`}
          className={styles.stepsGrid}
          data-testid={`steps-panel-${audience}`}
        >
          {steps.map((step) => (
            <div key={step.stepNumber} className={styles.stepCard} data-testid={`step-${step.stepNumber}`}>
              <div className={styles.stepBadge}>
                <span>{step.stepNumber}</span>
              </div>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepDescription}>{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
