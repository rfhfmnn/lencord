'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Loan, SubmitLoanInput } from '@/types';
import { useServices } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import { createSupabaseBrowserClient } from '@/services/supabase';
import { StepProgress } from './StepProgress';
import { Step1FormData, StepCompanyInfo } from './StepCompanyInfo';
import { Step2FormData, StepProjectConditions } from './StepProjectConditions';
import { Step3FormData, StepDocumentUpload } from './StepDocumentUpload';
import { Step4FormData, StepBankingAndSubmission } from './StepBankingAndSubmission';
import { ApplicationConfirmation } from './ApplicationConfirmation';
import { formatCuit } from './cuitValidator';
import styles from './solicitar.module.css';

export interface BorrowerProfile {
  id: string;
  email?: string;
  legal_name?: string;
  tax_id?: string;
  phone?: string;
  bank_cbu_cvu?: string;
  isVerified?: boolean;
}

export interface LoanWizardProps {
  initialStep?: number;
  initialStep1Data?: Partial<Step1FormData>;
  initialStep2Data?: Partial<Step2FormData>;
  initialStep3Data?: Step3FormData;
  initialStep4Data?: Partial<Step4FormData>;
  borrowerId?: string;
  userProfile?: BorrowerProfile | null;
  supabaseClient?: SupabaseClient;
  onSubmitted?: (loan: Loan) => void;
  redirectToConfirmationPage?: boolean;
}

export function LoanWizard({
  initialStep = 1,
  initialStep1Data,
  initialStep2Data,
  initialStep3Data,
  initialStep4Data,
  borrowerId: borrowerIdProp,
  userProfile: userProfileProp,
  supabaseClient,
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
  const [step1Data, setStep1Data] = useState<Partial<Step1FormData>>(() => {
    if (initialStep1Data) return initialStep1Data;
    if (userProfileProp) {
      return {
        legal_name: userProfileProp.legal_name || '',
        tax_id: userProfileProp.tax_id ? formatCuit(userProfileProp.tax_id) : '',
        email: userProfileProp.email || '',
        rep_phone: userProfileProp.phone || '',
      };
    }
    return {};
  });
  const [step2Data, setStep2Data] = useState<Partial<Step2FormData>>(initialStep2Data ?? {});
  const [step3Data, setStep3Data] = useState<Step3FormData>(initialStep3Data ?? {});
  const [step4Data, setStep4Data] = useState<Partial<Step4FormData>>(initialStep4Data ?? {});

  const [borrowerId, setBorrowerId] = useState<string>(
    borrowerIdProp ?? userProfileProp?.id ?? ''
  );
  const [isPrepopulated, setIsPrepopulated] = useState<boolean>(
    Boolean(userProfileProp && userProfileProp.isVerified !== false)
  );

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedLoan, setSubmittedLoan] = useState<Loan | null>(null);

  // Restore draft state from localStorage if available and no initial props were supplied
  useEffect(() => {
    if (initialStep1Data || initialStep2Data || initialStep3Data || initialStep4Data) {
      return;
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedDraft = window.localStorage.getItem('lencord_loan_wizard_draft');
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          if (parsed.step1Data) setStep1Data((prev) => ({ ...parsed.step1Data, ...prev }));
          if (parsed.step2Data) setStep2Data((prev) => ({ ...parsed.step2Data, ...prev }));
          if (parsed.step4Data) setStep4Data((prev) => ({ ...parsed.step4Data, ...prev }));
          if (parsed.step) setStep(parsed.step);
        }
      }
    } catch {
      // Ignore localStorage parse errors
    }
  }, []);

  // Save in-progress draft steps to localStorage to survive page refresh
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(
          'lencord_loan_wizard_draft',
          JSON.stringify({
            step,
            step1Data,
            step2Data,
            step4Data,
          })
        );
      }
    } catch {
      // Ignore localStorage write errors
    }
  }, [step, step1Data, step2Data, step4Data]);

  // Load authenticated borrower profile from props or Supabase session
  useEffect(() => {
    if (userProfileProp !== undefined) {
      if (userProfileProp) {
        setBorrowerId(userProfileProp.id);
        setIsPrepopulated(userProfileProp.isVerified !== false);
        setStep1Data((prev) => ({
          ...prev,
          legal_name: prev.legal_name || userProfileProp.legal_name || '',
          tax_id: prev.tax_id || (userProfileProp.tax_id ? formatCuit(userProfileProp.tax_id) : ''),
          email: prev.email || userProfileProp.email || '',
          rep_phone: prev.rep_phone || userProfileProp.phone || '',
        }));
        if (userProfileProp.bank_cbu_cvu) {
          setStep4Data((prev) => ({
            ...prev,
            cbu_cvu: prev.cbu_cvu || userProfileProp.bank_cbu_cvu,
          }));
        }
      }
      return;
    }

    let isMounted = true;
    async function resolveUserProfile() {
      try {
        const client = supabaseClient || createSupabaseBrowserClient();
        const { data: sessionData } = await client.auth.getSession();
        const authUser = sessionData?.session?.user;

        if (!authUser) {
          return;
        }

        if (isMounted) {
          setBorrowerId(authUser.id);
        }

        let legalName =
          authUser.user_metadata?.legal_name ||
          authUser.user_metadata?.company_name ||
          '';
        let taxId =
          authUser.user_metadata?.tax_id ||
          authUser.user_metadata?.cuit ||
          '';
        let phone = authUser.user_metadata?.phone || '';
        let cbu = authUser.user_metadata?.bank_cbu_cvu || '';

        try {
          const { data: profile } = await client
            .from('profiles')
            .select('id, tax_id, legal_name, phone, bank_cbu_cvu, role')
            .eq('id', authUser.id)
            .maybeSingle();

          if (profile) {
            if (profile.legal_name) legalName = profile.legal_name;
            if (profile.tax_id) taxId = profile.tax_id;
            if (profile.phone) phone = profile.phone;
            if (profile.bank_cbu_cvu) cbu = profile.bank_cbu_cvu;
          }
        } catch {
          // Keep metadata fallbacks
        }

        if (isMounted) {
          const hasVerifiedIdentity = Boolean(legalName || taxId);
          setIsPrepopulated(hasVerifiedIdentity);
          setStep1Data((prev) => ({
            ...prev,
            legal_name: prev.legal_name || legalName,
            tax_id: prev.tax_id || (taxId ? formatCuit(taxId) : ''),
            email: prev.email || authUser.email || '',
            rep_phone: prev.rep_phone || phone,
          }));
          if (cbu) {
            setStep4Data((prev) => ({
              ...prev,
              cbu_cvu: prev.cbu_cvu || cbu,
            }));
          }
        }
      } catch {
        // Fallback silently if session cannot be determined
      }
    }

    resolveUserProfile();
    return () => {
      isMounted = false;
    };
  }, [userProfileProp, supabaseClient]);

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

      let effectiveBorrowerId = borrowerId;
      if (!effectiveBorrowerId) {
        try {
          const client = supabaseClient || createSupabaseBrowserClient();
          const { data: sessionData } = await client.auth.getSession();
          if (sessionData?.session?.user?.id) {
            effectiveBorrowerId = sessionData.session.user.id;
          }
        } catch {
          // ignore
        }
      }

      if (!effectiveBorrowerId) {
        if (servicesFromContext) {
          effectiveBorrowerId = 'prof-sme-001';
        } else {
          throw new Error('Tu sesión ha expirado o no cuenta con permisos suficientes. Por favor, iniciá sesión nuevamente para continuar con tu solicitud.');
        }
      }

      const loanPayload: SubmitLoanInput = {
        borrower_id: effectiveBorrowerId,
        amount_requested: step2Data.amount_requested ?? 5000000,
        term_months: step2Data.term_months ?? 6,
        rate_type: step2Data.rate_type ?? 'TNA_FIXED',
        category: step2Data.category ?? 'working_capital',
        description: step2Data.description ? step2Data.description.trim() : undefined,
        afip_url:
          step3Data.afip_constancia_url ??
          (step3Data.afip_constancia
            ? `${effectiveBorrowerId}/afip_constancia-${step3Data.afip_constancia.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`
            : null),
        bank_statements_url:
          step3Data.bank_statements_url ??
          (step3Data.bank_statements
            ? `${effectiveBorrowerId}/bank_statements-${step3Data.bank_statements.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`
            : null),
        balance_sheet_url:
          step3Data.balance_sheet_url ??
          (step3Data.balance_sheet
            ? `${effectiveBorrowerId}/balance_sheet-${step3Data.balance_sheet.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`
            : null),
        f931_url:
          step3Data.f931_url ??
          (step3Data.f931
            ? `${effectiveBorrowerId}/f931-${step3Data.f931.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`
            : null),
      };

      const createdLoan = await resolvedServices.loans.submitLoanApplication(loanPayload);

      // Persist submitted loan receipt in localStorage to survive browser refresh
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem('lencord_loan_wizard_draft');
          window.localStorage.setItem(
            'lencord_last_submitted_loan',
            JSON.stringify({
              loan: createdLoan,
              legalName: step1Data.legal_name,
              taxId: step1Data.tax_id,
              submittedAt: new Date().toISOString(),
            })
          );
        }
      } catch {
        // Storage write ignored
      }

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
      let msg = err instanceof Error ? err.message : 'Error al enviar la solicitud de préstamo.';
      if (
        msg.toLowerCase().includes('row-level security') ||
        msg.toLowerCase().includes('violates') ||
        msg.toLowerCase().includes('unauthorized') ||
        msg.toLowerCase().includes('jwt')
      ) {
        msg = 'Tu sesión ha expirado o no cuenta con permisos suficientes. Por favor, iniciá sesión nuevamente para continuar con tu solicitud.';
      }
      setSubmitError(msg);
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
        <h1 className={styles.mainTitle}>Solicitud de financiamiento PyME</h1>
        <p className={styles.subtitle}>
          Completá el formulario en 4 simples pasos para publicar tu subasta en Lencord.
        </p>
      </div>

      <StepProgress currentStep={step} totalSteps={4} />

      {submitError && step !== 4 && (
        <div
          role="alert"
          data-testid="wizard-global-error"
          style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            background: '#FEF2F2',
            border: '1px solid #F87171',
            borderRadius: '8px',
            color: '#991B1B',
            fontSize: '0.875rem',
          }}
        >
          {submitError}
        </div>
      )}

      {step === 1 && (
        <StepCompanyInfo
          initialData={step1Data}
          isPrepopulated={isPrepopulated}
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
          borrowerId={borrowerId}
          supabaseClient={supabaseClient}
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
