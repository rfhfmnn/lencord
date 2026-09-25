import React from 'react';
import styles from './solicitar.module.css';

export interface StepProgressProps {
  currentStep: number;
  totalSteps?: number;
}

export const STEP_NAMES = [
  'Datos de la empresa',
  'Proyecto y condiciones',
  'Documentación de respaldo',
  'Datos bancarios y conformidad',
];

export function StepProgress({ currentStep, totalSteps = 4 }: StepProgressProps) {
  const currentStepName = STEP_NAMES[currentStep - 1] ?? `Paso ${currentStep}`;
  const progressPercent = (currentStep / totalSteps) * 100;

  return (
    <div className={styles.stepProgressContainer} data-testid="step-progress-indicator">
      <div className={styles.stepHeaderRow}>
        <span className={styles.stepCounterBadge} data-testid="step-counter-badge">
          Paso {currentStep} de {totalSteps}
        </span>
        <span className={styles.stepName} data-testid="step-current-name">
          {currentStepName}
        </span>
      </div>

      <div
        className={styles.stepProgressBar}
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label={`Paso ${currentStep} de ${totalSteps}: ${currentStepName}`}
      >
        <div
          className={styles.stepProgressFill}
          style={{ width: `${progressPercent}%` }}
          data-testid="step-progress-fill"
        />
      </div>

      <ol className={styles.stepIndicatorsList}>
        {STEP_NAMES.slice(0, totalSteps).map((name, index) => {
          const stepNum = index + 1;
          const isCompleted = stepNum < currentStep;
          const isActive = stepNum === currentStep;

          const itemClass = isActive
            ? styles.stepActive
            : isCompleted
            ? styles.stepCompleted
            : '';

          return (
            <li key={name} className={`${styles.stepItem} ${itemClass}`}>
              <div className={styles.stepCircle} data-testid={`step-circle-${stepNum}`}>
                {isCompleted ? '✓' : stepNum}
              </div>
              <span className={styles.stepLabel}>{name}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
