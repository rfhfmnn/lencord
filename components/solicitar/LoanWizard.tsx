'use client';

import React, { useState } from 'react';
import { StepProgress } from './StepProgress';
import { Step1FormData, StepCompanyInfo } from './StepCompanyInfo';
import { Step2FormData, StepProjectConditions } from './StepProjectConditions';
import styles from './solicitar.module.css';

export interface LoanWizardProps {
  initialStep?: number;
  initialStep1Data?: Partial<Step1FormData>;
  initialStep2Data?: Partial<Step2FormData>;
}

export function LoanWizard({
  initialStep = 1,
  initialStep1Data,
  initialStep2Data,
}: LoanWizardProps) {
  const [step, setStep] = useState<number>(initialStep);
  const [step1Data, setStep1Data] = useState<Partial<Step1FormData>>(initialStep1Data ?? {});
  const [step2Data, setStep2Data] = useState<Partial<Step2FormData>>(initialStep2Data ?? {});

  const handleStep1Continue = (data: Step1FormData) => {
    setStep1Data(data);
    setStep(2);
  };

  const handleStep2Back = (data?: Step2FormData) => {
    if (data) setStep2Data(data);
    setStep(1);
  };

  const handleStep2Continue = (data: Step2FormData) => {
    setStep2Data(data);
    setStep(3);
  };

  return (
    <div className={styles.container} data-testid="loan-application-wizard">
      <div className={styles.wizardHeader}>
        <h1 className={styles.mainTitle}>Solicitud de Financiamiento PyME</h1>
        <p className={styles.subtitle}>
          Completá el formulario en 4 simples pasos para publicar tu subasta en Lencord.
        </p>
      </div>

      <StepProgress currentStep={step} totalSteps={4} />

      {step === 1 && (
        <StepCompanyInfo
          initialData={step1Data}
          onContinue={handleStep1Continue}
        />
      )}

      {step === 2 && (
        <StepProjectConditions
          initialData={step2Data}
          onBack={handleStep2Back}
          onContinue={handleStep2Continue}
        />
      )}

      {step === 3 && (
        <div className={styles.formCard} data-testid="step3-container">
          <h2 className={styles.stepTitle}>Paso 3: Documentación de respaldo</h2>
          <p className={styles.stepDescription}>
            Subida de documentación impositiva y financiera de respaldo (Issue #12).
          </p>
        </div>
      )}

      {step === 4 && (
        <div className={styles.formCard} data-testid="step4-container">
          <h2 className={styles.stepTitle}>Paso 4: Datos bancarios y conformidad</h2>
          <p className={styles.stepDescription}>
            CBU/CVU de acreditación y declaraciones juradas (Issue #12).
          </p>
        </div>
      )}
    </div>
  );
}
