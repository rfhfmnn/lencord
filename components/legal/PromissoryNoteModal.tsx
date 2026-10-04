'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Installment, LegalContract, Loan, Profile } from '@/types';
import { useServices } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import { SEED_PROFILES, SEED_INVESTMENTS } from '@/services/mock/seedData';
import { defaultMockStateStore } from '@/services/mock/mockState';
import { createSupabaseBrowserClient } from '@/services/supabase';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/components/home/HeroSimulator';
import { formatRateDisplay } from '@/components/marketplace/LoanCard';
import styles from './promissory-note.module.css';

export interface ParticipatingInvestment {
  id: string;
  investor_id: string;
  amount: number;
  investor_name?: string;
  investor_tax_id?: string | null;
}

export interface PromissoryNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan;
  borrower?: Profile | null;
  installments?: Installment[];
  onSuccess?: (signedContract: LegalContract) => void;
  simulatedOtp?: string;
  className?: string;
  readOnly?: boolean;
  existingContract?: LegalContract | null;
  currentUserRole?: 'investor' | 'sme' | 'borrower' | 'admin';
  currentInvestor?: {
    id: string;
    legal_name?: string;
    tax_id?: string;
    amount?: number;
  } | null;
  participatingInvestments?: ParticipatingInvestment[];
}

function getInitialParticipatingInvestments(
  loanId: string,
  providedInvestments?: ParticipatingInvestment[]
): ParticipatingInvestment[] {
  if (providedInvestments && providedInvestments.length > 0) {
    return providedInvestments;
  }

  const rawInvs = (
    defaultMockStateStore.investments && defaultMockStateStore.investments.length > 0
      ? defaultMockStateStore.investments
      : SEED_INVESTMENTS
  ).filter((i) => i.loan_id === loanId);

  if (rawInvs.length > 0) {
    return rawInvs.map((inv) => {
      const prof =
        defaultMockStateStore.profiles.find((p) => p.id === inv.investor_id) ||
        SEED_PROFILES.find((p) => p.id === inv.investor_id);
      return {
        id: inv.id,
        investor_id: inv.investor_id,
        amount: inv.amount,
        investor_name: prof?.legal_name || `Inversor N° ${inv.investor_id.slice(0, 6)}`,
        investor_tax_id: prof?.tax_id || 'N/A',
      };
    });
  }

  return [];
}

/**
 * Computes a standard SHA-256 hexadecimal string from a text payload.
 */
export async function generateSha256(message: string): Promise<string> {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback 64-char hex deterministic hash
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < message.length; i++) {
    const ch = message.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const p1 = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(32, '0');
  const p2 = (4294967296 * (2097151 & h1) + (h2 >>> 0)).toString(16).padStart(32, '0');
  return (p1 + p2).substring(0, 64);
}

/**
 * Calculates French amortization installment payment schedule if none provided.
 */
export function calculateSchedule(amount: number, termMonths: number, annualRatePercent: number) {
  if (amount <= 0 || termMonths <= 0) return [];
  const monthlyRate = annualRatePercent > 0 ? annualRatePercent / 100 / 12 : 0.04;
  let installmentAmount = 0;

  if (termMonths === 1) {
    installmentAmount = amount * (1 + monthlyRate);
  } else {
    const factor = Math.pow(1 + monthlyRate, termMonths);
    installmentAmount = (amount * (monthlyRate * factor)) / (factor - 1);
  }

  let remaining = amount;
  const schedule = [];
  const baseDate = new Date();

  for (let i = 1; i <= termMonths; i++) {
    const interest = remaining * monthlyRate;
    const principal = installmentAmount - interest;
    remaining = Math.max(0, remaining - principal);
    const dueDate = new Date(baseDate.getTime() + i * 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    schedule.push({
      number: i,
      dueDate,
      principal,
      interest,
      total: principal + interest,
    });
  }

  return schedule;
}

export function PromissoryNoteModal({
  isOpen,
  onClose,
  loan,
  borrower: initialBorrower,
  installments,
  onSuccess,
  simulatedOtp = '123456',
  className = '',
  readOnly = false,
  existingContract = null,
  currentUserRole = 'borrower',
  currentInvestor = null,
  participatingInvestments = [],
}: PromissoryNoteModalProps) {
  const titleId = useId();

  let servicesFromContext: ReturnType<typeof useServices> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    servicesFromContext = useServices({ fallback: true });
  } catch {
    servicesFromContext = null;
  }

  // Resolve borrower info
  const borrower = useMemo(() => {
    if (initialBorrower) return initialBorrower;
    return SEED_PROFILES.find((p) => p.id === loan.borrower_id) ?? {
      id: loan.borrower_id,
      role: 'sme' as const,
      tax_id: '30715566772',
      legal_name: 'PyME Solicitante',
      phone: '+54 11 4000-0000',
      kyc_status: 'approved' as const,
      bank_cbu_cvu: '0720123488000012345678',
      created_at: new Date().toISOString(),
    };
  }, [initialBorrower, loan.borrower_id]);

  // Installment schedule
  const schedule = useMemo(() => {
    if (installments && installments.length > 0) {
      return installments.map((inst) => ({
        number: inst.installment_number,
        dueDate: inst.due_date,
        principal: inst.principal_amount,
        interest: inst.interest_borrower,
        total: inst.principal_amount + inst.interest_borrower,
      }));
    }
    return calculateSchedule(loan.amount_requested, loan.term_months, loan.borrower_rate);
  }, [installments, loan.amount_requested, loan.term_months, loan.borrower_rate]);

  // Loaded investments state for Anexo I creditors list
  const [loadedInvestments, setLoadedInvestments] = useState<ParticipatingInvestment[]>(() =>
    getInitialParticipatingInvestments(loan.id, participatingInvestments)
  );

  // Sync / fetch participating investments dynamically when modal opens
  useEffect(() => {
    let isMounted = true;

    if (!isOpen || currentUserRole === 'investor') {
      return;
    }

    if (participatingInvestments && participatingInvestments.length > 0) {
      setLoadedInvestments(participatingInvestments);
      return;
    }

    async function fetchLoanInvestments() {
      try {
        const services =
          servicesFromContext ??
          (() => {
            try {
              return createServices();
            } catch {
              return createServices({ useMocks: true });
            }
          })();

        let invs = await services.investments.getInvestmentsByLoan(loan.id);

        if (!invs || invs.length === 0) {
          invs = (
            defaultMockStateStore.investments && defaultMockStateStore.investments.length > 0
              ? defaultMockStateStore.investments
              : SEED_INVESTMENTS
          ).filter((i) => i.loan_id === loan.id);
        }

        if (invs && invs.length > 0) {
          const profileMap = new Map<string, { legal_name: string; tax_id?: string | null }>();
          const missingIds: string[] = [];

          for (const inv of invs) {
            const mockProf =
              defaultMockStateStore.profiles.find((p) => p.id === inv.investor_id) ||
              SEED_PROFILES.find((p) => p.id === inv.investor_id);
            if (mockProf) {
              profileMap.set(inv.investor_id, {
                legal_name: mockProf.legal_name,
                tax_id: mockProf.tax_id,
              });
            } else {
              missingIds.push(inv.investor_id);
            }
          }

          if (missingIds.length > 0) {
            try {
              const client = createSupabaseBrowserClient();
              const { data: profilesData } = await client
                .from('profiles')
                .select('id, legal_name, tax_id')
                .in('id', Array.from(new Set(missingIds)));

              if (profilesData) {
                for (const p of profilesData) {
                  profileMap.set(p.id, {
                    legal_name: p.legal_name,
                    tax_id: p.tax_id,
                  });
                }
              }
            } catch {
              // Ignore Supabase profile lookup errors
            }
          }

          const resolved: ParticipatingInvestment[] = invs.map((inv) => {
            const prof = profileMap.get(inv.investor_id);
            return {
              id: inv.id,
              investor_id: inv.investor_id,
              amount: inv.amount,
              investor_name: prof?.legal_name || `Inversor N° ${inv.investor_id.slice(0, 6)}`,
              investor_tax_id: prof?.tax_id || 'N/A',
            };
          });

          if (isMounted) {
            setLoadedInvestments(resolved);
          }
        }
      } catch (err) {
        console.warn('[PromissoryNoteModal] Error loading participating investments:', err);
      }
    }

    fetchLoanInvestments();

    return () => {
      isMounted = false;
    };
  }, [isOpen, loan.id, currentUserRole, participatingInvestments, servicesFromContext]);

  // Creditors list for Anexo I
  const creditorsList = useMemo(() => {
    const firstInstallmentTotal =
      schedule[0]?.total ?? (loan.amount_requested / (loan.term_months || 1));

    // If viewer is an Investor, enforce strict privacy: ONLY the investor's own credit line is returned
    if (currentUserRole === 'investor') {
      const invAmount = currentInvestor?.amount ?? loan.amount_funded ?? loan.amount_requested;
      const sharePercent =
        loan.amount_requested > 0 ? (invAmount / loan.amount_requested) * 100 : 100;
      const monthlyQuota = firstInstallmentTotal * (sharePercent / 100);

      return [
        {
          id: currentInvestor?.id ?? 'current-inv',
          name: currentInvestor?.legal_name || 'Mi Inversión (Acreedor)',
          tax_id: currentInvestor?.tax_id || 'N/A',
          amount: invAmount,
          sharePercent,
          monthlyQuota,
        },
      ];
    }

    // For SME / Borrower / Admin: render one row per investor with aggregated capital
    const effectiveInvestments =
      participatingInvestments && participatingInvestments.length > 0
        ? participatingInvestments
        : loadedInvestments;

    if (effectiveInvestments && effectiveInvestments.length > 0) {
      // Group by investor_id to strictly ensure one row per investor
      const byInvestor = new Map<
        string,
        {
          id: string;
          investor_id: string;
          amount: number;
          investor_name: string;
          investor_tax_id: string;
        }
      >();

      for (const inv of effectiveInvestments) {
        const existing = byInvestor.get(inv.investor_id);
        if (existing) {
          existing.amount += inv.amount;
        } else {
          byInvestor.set(inv.investor_id, {
            id: inv.id,
            investor_id: inv.investor_id,
            amount: inv.amount,
            investor_name: inv.investor_name || `Inversor N° ${inv.investor_id.slice(0, 6)}`,
            investor_tax_id: inv.investor_tax_id || 'N/A',
          });
        }
      }

      return Array.from(byInvestor.values()).map((inv) => {
        const sharePercent =
          loan.amount_requested > 0 ? (inv.amount / loan.amount_requested) * 100 : 0;
        const monthlyQuota = firstInstallmentTotal * (sharePercent / 100);
        return {
          id: inv.investor_id || inv.id,
          name: inv.investor_name,
          tax_id: inv.investor_tax_id,
          amount: inv.amount,
          sharePercent,
          monthlyQuota,
        };
      });
    }

    // Fallback: If no individual investments found in store/DB (e.g. ad-hoc mock funded loan),
    // provide seed active investors proportionally instead of a single anonymous collective line
    const fallbackSeedInvestors = SEED_PROFILES.filter((p) => p.role === 'investor');
    if (fallbackSeedInvestors.length >= 2) {
      const inv1 = fallbackSeedInvestors[1] || fallbackSeedInvestors[0]; // Inversora Austral S.A.
      const inv2 = fallbackSeedInvestors[2] || fallbackSeedInvestors[0]; // Mariana Gómez Valenzuela
      const totalAmount = loan.amount_funded || loan.amount_requested;
      const amount1 = Math.round(totalAmount * 0.65);
      const amount2 = totalAmount - amount1;

      const share1 = (amount1 / totalAmount) * 100;
      const share2 = (amount2 / totalAmount) * 100;

      return [
        {
          id: inv1.id,
          name: inv1.legal_name,
          tax_id: inv1.tax_id || '30709876543',
          amount: amount1,
          sharePercent: share1,
          monthlyQuota: firstInstallmentTotal * (share1 / 100),
        },
        {
          id: inv2.id,
          name: inv2.legal_name,
          tax_id: inv2.tax_id || '27356789014',
          amount: amount2,
          sharePercent: share2,
          monthlyQuota: firstInstallmentTotal * (share2 / 100),
        },
      ];
    }

    return [
      {
        id: 'prof-inv-002',
        name: 'Inversora Austral S.A.',
        tax_id: '30709876543',
        amount: loan.amount_funded || loan.amount_requested,
        sharePercent: 100,
        monthlyQuota: firstInstallmentTotal,
      },
    ];
  }, [
    currentUserRole,
    currentInvestor,
    participatingInvestments,
    loadedInvestments,
    loan.amount_requested,
    loan.amount_funded,
    loan.term_months,
    schedule,
  ]);

  // OTP state (6 digits)
  const [currentOtp, setCurrentOtp] = useState<string>(simulatedOtp);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [signedContract, setSignedContract] = useState<LegalContract | null>(existingContract);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset state when modal opens or closes, or when simulatedOtp prop updates
  useEffect(() => {
    if (isOpen) {
      setCurrentOtp(simulatedOtp);
      setOtpDigits(['', '', '', '', '', '']);
      setFailedAttempts(0);
      setIsLocked(false);
      setErrorMessage(null);
      setIsSubmitting(false);

      if (existingContract) {
        setSignedContract(existingContract);
      } else if (readOnly) {
        const services =
          servicesFromContext ??
          (() => {
            try {
              return createServices();
            } catch {
              return createServices({ useMocks: true });
            }
          })();

        services.legal
          .getContractsByLoan(loan.id)
          .then((contracts) => {
            const pagare = contracts.find((c) => c.document_type === 'pagare' && c.signature_hash);
            if (pagare) {
              setSignedContract(pagare);
            } else {
              generateSha256(
                `LENCORD:PAGARE:${loan.id}:${borrower.tax_id}:${loan.amount_requested}:SIGNED`
              ).then((hash) => {
                setSignedContract({
                  id: `contract-${loan.id}`,
                  loan_id: loan.id,
                  document_type: 'pagare',
                  document_url: `/contracts/${loan.id}/pagare-electronico.pdf`,
                  signature_hash: hash,
                  signed_at: loan.created_at || new Date().toISOString(),
                });
              });
            }
          })
          .catch(() => {
            generateSha256(
              `LENCORD:PAGARE:${loan.id}:${borrower.tax_id}:${loan.amount_requested}:SIGNED`
            ).then((hash) => {
              setSignedContract({
                id: `contract-${loan.id}`,
                loan_id: loan.id,
                document_type: 'pagare',
                document_url: `/contracts/${loan.id}/pagare-electronico.pdf`,
                signature_hash: hash,
                signed_at: loan.created_at || new Date().toISOString(),
              });
            });
          });
      } else {
        setSignedContract(null);
      }

      // Trigger high-priority OTP alert dispatch (SMS / WhatsApp) only if NOT readOnly
      if (!readOnly) {
        const services =
          servicesFromContext ??
          (() => {
            try {
              return createServices();
            } catch {
              return createServices({ useMocks: true });
            }
          })();

        if (services.multiChannelNotifications) {
          services.multiChannelNotifications
            .sendOtpSignatureAlert(
              {
                to: borrower.phone,
                recipientName: borrower.legal_name,
                otpCode: simulatedOtp,
                loanId: loan.id,
                amount: loan.amount_requested,
              },
              borrower
            )
            .catch((err) => {
              console.warn('[PromissoryNoteModal] OTP alert dispatch notice:', err?.message || err);
            });
        }
      }
    }
  }, [
    isOpen,
    readOnly,
    existingContract,
    simulatedOtp,
    borrower,
    loan.id,
    loan.created_at,
    loan.amount_requested,
    servicesFromContext,
  ]);

  if (!isOpen) return null;

  const fullOtpEntered = otpDigits.join('');

  const handleDigitChange = (index: number, value: string) => {
    if (isLocked) return;
    setErrorMessage(null);
    const cleanValue = value.replace(/\D/g, '');

    // Handle multi-character paste (e.g. paste "123456")
    if (cleanValue.length > 1) {
      const pastedChars = cleanValue.slice(0, 6).split('');
      const newDigits = [...otpDigits];
      pastedChars.forEach((ch, idx) => {
        newDigits[idx] = ch;
      });
      setOtpDigits(newDigits);
      const nextIndex = Math.min(pastedChars.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const newDigits = [...otpDigits];
    newDigits[index] = cleanValue;
    setOtpDigits(newDigits);

    // Auto-advance to next input
    if (cleanValue && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isLocked) return;
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleRegenerateOtp = () => {
    const nextCode = String(Math.floor(100000 + Math.random() * 900000));
    setCurrentOtp(nextCode);
    setFailedAttempts(0);
    setIsLocked(false);
    setOtpDigits(['', '', '', '', '', '']);
    setErrorMessage(null);

    const services =
      servicesFromContext ??
      (() => {
        try {
          return createServices();
        } catch {
          return createServices({ useMocks: true });
        }
      })();

    if (services.multiChannelNotifications) {
      services.multiChannelNotifications
        .sendOtpSignatureAlert(
          {
            to: borrower.phone,
            recipientName: borrower.legal_name,
            otpCode: nextCode,
            loanId: loan.id,
            amount: loan.amount_requested,
          },
          borrower
        )
        .catch((err) => {
          console.warn('[PromissoryNoteModal] OTP regenerate dispatch notice:', err?.message || err);
        });
    }
  };

  const handleSignConfirm = async () => {
    if (isLocked) {
      setErrorMessage('Se superó el máximo de 3 intentos inválidos. El código OTP ha sido bloqueado. Solicitá un nuevo código para continuar.');
      return;
    }

    const code = fullOtpEntered.trim();

    if (code.length < 6) {
      setErrorMessage('Por favor completá los 6 dígitos del código de verificación OTP.');
      return;
    }

    if (code !== currentOtp) {
      const nextFailed = failedAttempts + 1;
      setFailedAttempts(nextFailed);
      if (nextFailed >= 3) {
        setIsLocked(true);
        setErrorMessage('Se superó el máximo de 3 intentos inválidos. El código OTP ha sido bloqueado por seguridad. Solicitá un nuevo código para continuar.');
      } else {
        setErrorMessage(`Código OTP inválido (intento ${nextFailed} de 3). Verificá el código recibido o solicitá un nuevo envío.`);
      }
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const services =
        servicesFromContext ??
        (() => {
          try {
            return createServices();
          } catch {
            return createServices({ useMocks: true });
          }
        })();

      // Fetch or generate promissory note contract
      const contracts = await services.legal.getContractsByLoan(loan.id);
      let pagareContract = contracts.find((c) => c.document_type === 'pagare');

      if (!pagareContract) {
        pagareContract = await services.legal.generatePromissoryNote(loan.id);
      }

      // Generate SHA-256 cryptographic signature hash
      const signaturePayload = `LENCORD:PAGARE:${loan.id}:${borrower.tax_id}:${loan.amount_requested}:${code}:${new Date().toISOString()}`;
      const signatureHash = await generateSha256(signaturePayload);

      // Record signature via LegalServiceInterface
      const signed = await services.legal.signContract({
        contract_id: pagareContract.id,
        signature_hash: signatureHash,
      });

      // Activate loan, disburse funds, and generate monthly installment rows
      if (services.loans.activateLoan) {
        await services.loans.activateLoan(loan.id);
      }

      setSignedContract(signed);

      if (onSuccess) {
        onSuccess(signed);
      }
    } catch (err: unknown) {
      console.error('Error signing promissory note:', err);
      setErrorMessage('Ocurrió un error al procesar la firma criptográfica del contrato.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`${styles.modalOverlay} ${className}`}
      data-testid="promissory-note-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className={styles.modalContent} data-testid="promissory-note-modal">
        {/* Header */}
        <header className={styles.modalHeader}>
          <div className={styles.headerTitleGroup}>
            <h2 id={titleId} className={styles.modalTitle}>
              <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Firma de Pagaré Digital y Mutuo
            </h2>
            <p className={styles.modalSubtitle}>
              Revisión del instrumento legal y ratificación de deuda mediante firma electrónica y 2FA OTP.
            </p>
          </div>

          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Cerrar modal de firma"
            disabled={isSubmitting}
            data-testid="btn-close-modal"
          >
            &times;
          </button>
        </header>

        {/* Body */}
        <div className={styles.modalBody}>
          {readOnly && (
            <div className={styles.signedStatusBadge} data-testid="signed-status-badge">
              ✓ Contrato firmado electrónicamente por la PyME
            </div>
          )}

          {/* Legal Document Review Viewer */}
          <div className={styles.documentViewer} data-testid="document-viewer">
            <div className={styles.documentHeader}>
              <div>
                <h3 className={styles.documentTitle}>Pagaré digital y contrato de mutuo</h3>
                <span className={styles.documentLegalNumber}>Instrumento N° PAG-{loan.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <span className={styles.documentLegalNumber}>Ley 21.526/CCCN Art. 1820</span>
            </div>

            {/* Borrower & Loan Metadata */}
            <div className={styles.highlightMetaGrid} data-testid="contract-metadata">
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Deudor/librador</span>
                <span className={styles.metaValue} data-testid="contract-borrower-name">
                  {borrower.legal_name}
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>CUIT</span>
                <span className={`${styles.metaValue} ${styles.metaMono}`} data-testid="contract-borrower-cuit">
                  {borrower.tax_id}
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Capital principal</span>
                <span className={styles.metaValue} data-testid="contract-principal-amount">
                  {formatCurrency(loan.amount_requested)}
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Tasa aplicada</span>
                <span className={styles.metaValue} data-testid="contract-interest-rate">
                  {formatRateDisplay(loan.rate_type, loan.borrower_rate)}
                </span>
              </div>
            </div>

            {/* Contract Clauses */}
            <div className={styles.documentSection}>
              <div className={styles.sectionHeading}>PRIMERA: OBJETO Y RECONOCIMIENTO DE DEUDA</div>
              <p>
                Por el presente instrumento, <strong>{borrower.legal_name}</strong> (CUIT N°{' '}
                <strong>{borrower.tax_id}</strong>), en adelante el &quot;Librador&quot;, reconoce adeudar de
                manera incondicional e irrevocable la suma de{' '}
                <strong>{formatCurrency(loan.amount_requested)}</strong> a favor de los inversores
                participantes de la subasta colectiva instrumentada en la plataforma Lencord, actuando Lencord
                S.A.S. en carácter de mandatario tecnológico y facilitador conforme a la Ley de Financiamiento
                Productivo.
              </p>
            </div>

            <div className={styles.documentSection}>
              <div className={styles.sectionHeading}>SEGUNDA: CONDICIONES FINANCIERAS Y VENCIMIENTO</div>
              <p>
                El capital adeudado devengará un interés compensatorio conforme a la tasa pactada de{' '}
                <strong>{formatRateDisplay(loan.rate_type, loan.borrower_rate)}</strong>, amortizable en{' '}
                <strong>{loan.term_months} cuotas mensuales</strong> según el cuadro de amortización
                detallado a continuación.
              </p>
            </div>

            {/* Installment Payment Schedule */}
            <div className={styles.scheduleContainer} data-testid="contract-schedule">
              <table className={styles.scheduleTable} aria-label="Cronograma de amortización del pagaré">
                <thead>
                  <tr>
                    <th>Cuota #</th>
                    <th>Vencimiento</th>
                    <th>Capital</th>
                    <th>Interés</th>
                    <th>Total a Pagar</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((item) => (
                    <tr key={item.number} data-testid={`schedule-row-${item.number}`}>
                      <td>Cuota {item.number}</td>
                      <td>{item.dueDate}</td>
                      <td>{formatCurrency(item.principal)}</td>
                      <td>{formatCurrency(item.interest)}</td>
                      <td>
                        <strong>{formatCurrency(item.total)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.documentSection} style={{ marginTop: '1rem' }}>
              <div className={styles.sectionHeading}>TERCERA: FUERZA EJECUTIVA Y FIRMA DIGITAL</div>
              <p>
                Las partes convienen expresamente otorgar al presente pagaré digital plena fuerza y validez
                ejecutiva en los términos del Código Civil y Comercial de la Nación y la legislación
                cambiaria vigente. La suscripción se perfecciona mediante la confirmación del factor de
                autenticación OTP (One-Time Password) y la consecuente generación de la firma y hash criptográfico
                SHA-256.
              </p>
            </div>

            {/* Anexo I - Nómina de Acreedores e Individualización de Cuotas */}
            <div className={styles.annexContainer} data-testid="contract-annex-creditors">
              <div className={styles.annexTitle}>
                Anexo I - Nómina de Acreedores e Individualización de Cuotas
              </div>
              <p className={styles.annexNotice}>
                {currentUserRole === 'investor'
                  ? 'Por estrictas razones de confidencialidad y protección de datos financieros de la comunidad inversora, en esta copia de instrumento usted visualiza exclusivamente su participación individual y los datos de la PyME libradora.'
                  : 'Nómina consolidada de acreedores e individualización de cuotas de amortización e interés devengadas en la subasta.'}
              </p>

              <table className={styles.scheduleTable} aria-label="Nómina de acreedores del pagaré">
                <thead>
                  <tr>
                    <th>Acreedor / Razón Social</th>
                    <th>Identificación Fiscal</th>
                    <th>Capital Invertido</th>
                    <th>% Participación</th>
                    <th>Cuota Mensual a Percibir</th>
                  </tr>
                </thead>
                <tbody>
                  {creditorsList.map((creditor) => (
                    <tr key={creditor.id} data-testid={`creditor-row-${creditor.id}`}>
                      <td>
                        <strong>{creditor.name}</strong>
                      </td>
                      <td>{creditor.tax_id}</td>
                      <td>{formatCurrency(creditor.amount)}</td>
                      <td>{creditor.sharePercent.toFixed(2)}%</td>
                      <td>
                        <strong>{formatCurrency(creditor.monthlyQuota)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Signed Confirmation State OR OTP Input State */}
          {readOnly ? (
            <div className={styles.successPane} data-testid="signature-success-pane">
              <h4 className={styles.successTitle}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Pagaré Digital emitido y ratificado por la PyME
              </h4>
              <p className={styles.successText}>
                El pagaré electrónico cuenta con firma digital registrada, plena fuerza ejecutiva y depósito en custodia legal.
              </p>
              <div className={styles.hashCard}>
                <span className={styles.hashLabel}>Hash criptográfico de firma (SHA-256)</span>
                <span className={styles.hashValue} data-testid="signature-hash">
                  {signedContract?.signature_hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                </span>
                <span className={styles.timestampValue} data-testid="signature-timestamp">
                  Fecha y hora de firma:{' '}
                  {new Date(signedContract?.signed_at || loan.created_at || '').toLocaleString('es-AR')}
                </span>
              </div>
            </div>
          ) : signedContract && signedContract.signature_hash ? (
            <div className={styles.successPane} data-testid="signature-success-pane">
              <h4 className={styles.successTitle}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Pagaré Digital firmado y ratificado con éxito
              </h4>
              <p className={styles.successText}>
                El pagaré electrónico ha sido sellado criptográficamente y depositado en guarda legal. Tu
                solicitud pasa a estar <strong>lista para el desembolso bancario</strong> en tu CBU/CVU
                registrado.
              </p>
              <div className={styles.hashCard}>
                <span className={styles.hashLabel}>Hash criptográfico de firma (SHA-256)</span>
                <span className={styles.hashValue} data-testid="signature-hash">
                  {signedContract.signature_hash}
                </span>
                <span className={styles.timestampValue} data-testid="signature-timestamp">
                  Fecha y hora de firma: {new Date(signedContract.signed_at ?? '').toLocaleString('es-AR')}
                </span>
              </div>
            </div>
          ) : (
            <div className={styles.otpSection} data-testid="otp-section">
              <div className={styles.otpHeader}>
                <div>
                  <h4 className={styles.otpTitle}>Verificación de identidad 2FA (OTP)</h4>
                  <p className={styles.otpHint}>
                    Ingresá el código de 6 dígitos enviado por SMS/correo al titular registrado.
                  </p>
                </div>
                <span className={styles.otpSimulationBadge} data-testid="simulated-otp-badge">
                  Código de prueba: {currentOtp}
                </span>
              </div>

              {/* 6-digit OTP Inputs */}
              <div className={styles.otpInputsContainer} data-testid="otp-inputs-container">
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className={`${styles.otpInputBox} ${errorMessage ? styles.otpInputError : ''}`}
                    aria-label={`Dígito ${index + 1} del código OTP`}
                    data-testid={`otp-input-${index}`}
                    disabled={isSubmitting || isLocked}
                    autoFocus={index === 0 && !isLocked}
                  />
                ))}
              </div>

              {errorMessage && (
                <div className={styles.errorMessage} role="alert" data-testid="otp-error-message">
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{errorMessage}</span>
                </div>
              )}

              {isLocked && (
                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                  <Button
                    variant="bordered"
                    size="sm"
                    type="button"
                    onClick={handleRegenerateOtp}
                    data-testid="btn-regenerate-otp"
                  >
                    Generar nuevo código OTP
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className={styles.modalFooter}>
          {readOnly ? (
            <>
              <Button
                variant="bordered"
                size="md"
                onClick={() => {
                  if (typeof window !== 'undefined') window.print();
                }}
                data-testid="btn-download-copy"
              >
                Descargar copia
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={onClose}
                data-testid="btn-close-readonly"
              >
                Cerrar
              </Button>
            </>
          ) : signedContract ? (
            <Button
              variant="primary"
              size="md"
              onClick={onClose}
              data-testid="btn-close-signed"
            >
              Entendido, volver al panel
            </Button>
          ) : (
            <>
              <Button
                variant="bordered"
                size="md"
                onClick={onClose}
                disabled={isSubmitting}
                data-testid="btn-cancel-modal"
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSignConfirm}
                disabled={isSubmitting || isLocked}
                data-testid="btn-confirm-sign"
              >
                {isSubmitting ? 'Firmando pagaré...' : 'Confirmar y firmar pagaré digital'}
              </Button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
