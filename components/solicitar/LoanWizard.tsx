'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Loan } from '@/types';
import { useServices } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import { StepProgress } from './StepProgress';
import { Step1FormData, StepCompanyInfo } from './StepCompanyInfo';
import { Step2FormData, StepProjectConditions } from './StepProjectConditions';
import { Step3FormData, StepDocumentUpload } from './StepDocumentUpload';
import { Step4FormData, StepBankingAndSubmission } from './StepBankingAndSubmission';
import { ApplicationConfirmation } from './ApplicationConfirmation';
import styles from './solicitar.module.css';

export interface LoanWizardProps {
  initialStep?: number;
  initialStep1Data?: Partial<Step1FormData>;
  initialStep2Data?: Partial<Step2FormData>;
  initialStep3Data?: Step3FormData;
  initialStep4Data?: Partial<Step4FormData>;
  borrowerId?: string;
  onSubmitted?: (loan: Loan) => void;
  redirectToConfirmationPage?: boolean;
}

export function LoanWizard({
  initialStep = 1,
  initialStep1Data,
  initialStep2Data,
  initialStep3Data,
  initialStep4Data,
  borrowerId = 'prof-sme-001',
  onSubmitted,
  redirectToConfirmationPage = false,
}: LoanWizardProps) {
  let router: ReturnType<typeof useRouter> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter();
  } catch {
    router = null;
  }

  let servicesFromContext: ReturnType<typeof useServices> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    servicesFromContext = useServices({ fallback: true });
  } catch {
    servicesFromContext = null;
  }

  const [step, setStep] = useState<number>(initialStep);
  const [step1Data, setStep1Data] = useState<Partial<Step1FormData>>(initialStep1Data ?? {});
  const [step2Data, setStep2Data] = useState<Partial<Step2FormData>>(initialStep2Data ?? {});
  const [step3Data, setStep3Data] = useState<Step3FormData>(initialStep3Data ?? {});
  const [step4Data, setStep4Data] = useState<Partial<Step4FormData>>(initialStep4Data ?? {});

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedLoan, setSubmittedLoan] = useState<Loan | null>(null);

  // Step 1 -> Step 2
  const handleStep1Continue = (data: Step1FormData) => {
    setStep1Data(data);
    setStep(2);
  };

  // Step 2 -> Step 1
  const handleStep2Back = (data?: Step2FormData) => {
    if (data) setStep2Data(data);
    setStep(1);
  };

  // Step 2 -> Step 3
  const handleStep2Continue = (data: Step2FormData) => {
    setStep2Data(data);
    setStep(3);
  };

  // Step 3 -> Step 2
  const handleStep3Back = (data?: Step3FormData) => {
    if (data) setStep3Data(data);
    setStep(2);
  };

  // Step 3 -> Step 4
  const handleStep3Continue = (data: Step3FormData) => {
    setStep3Data(data);
    setStep(4);
  };

  // Step 4 -> Step 3
  const handleStep4Back = (data?: Step4FormData) => {
    if (data) setStep4Data(data);
    setStep(3);
  };

  // Step 4 -> Final Submit
  const handleFinalSubmit = async (data: Step4FormData) => {
    setStep4Data(data);
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const resolvedServices =
        servicesFromContext ??
        (() => {
          try {
            return createServices();
          } catch {
            return createServices({ useMocks: true });
          }
        })();

      const loanPayload = {
        borrower_id: borrowerId,
        amount_requested: step2Data.amount_requested ?? 5000000,
        term_months: step2Data.term_months ?? 6,
        rate_type: step2Data.rate_type ?? 'TNA_FIXED',
        category: step2Data.category ?? 'working_capital',
        balance_sheet_url: step3Data.balance_sheet
          ? `https://storage.lencord.ar/documents/${borrowerId}/${step3Data.balance_sheet.name}`
          : null,
        f931_url: step3Data.f931
          ? `https://storage.lencord.ar/documents/${borrowerId}/${step3Data.f931.name}`
          : null,
      };

      const createdLoan = await resolvedServices.loans.submitLoanApplication(loanPayload);

      setSubmittedLoan(createdLoan);
      if (onSubmitted) {
        onSubmitted(createdLoan);
      }

      if (redirectToConfirmationPage && router) {
        const queryParams = new URLSearchParams({
          loanId: createdLoan.id,
          amount: String(createdLoan.amount_requested),
          term: String(createdLoan.term_months),
          category: createdLoan.category,
          rateType: createdLoan.rate_type,
          legalName: step1Data.legal_name ?? '',
          taxId: step1Data.tax_id ?? '',
        });
        router.push(`/solicitar/confirmacion?${queryParams.toString()}`);
      }
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Error al enviar la solicitud de préstamo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // If already submitted and rendered inline, display confirmation receipt
  if (submittedLoan) {
    return (
      <div className={styles.container} data-testid="loan-application-wizard">
        <ApplicationConfirmation
          loan={submittedLoan}
          legalName={step1Data.legal_name}
          taxId={step1Data.tax_id}
        />
      </div>
    );
  }

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
        <StepDocumentUpload
          initialData={step3Data}
          onBack={handleStep3Back}
          onContinue={handleStep3Continue}
        />
      )}

      {step === 4 && (
        <StepBankingAndSubmission
          initialData={step4Data}
          onBack={handleStep4Back}
          onSubmit={handleFinalSubmit}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      )}
    </div>
  );
}
