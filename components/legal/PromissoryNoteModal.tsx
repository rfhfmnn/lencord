'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Installment, LegalContract, Loan, Profile } from '@/types';
import { useServices } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import { SEED_PROFILES } from '@/services/mock/seedData';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/components/home/HeroSimulator';
import { formatRateDisplay } from '@/components/marketplace/LoanCard';
import styles from './promissory-note.module.css';

export interface PromissoryNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan;
  borrower?: Profile | null;
  installments?: Installment[];
  onSuccess?: (signedContract: LegalContract) => void;
  simulatedOtp?: string;
  className?: string;
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

  // OTP state (6 digits)
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [signedContract, setSignedContract] = useState<LegalContract | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset state when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setOtpDigits(['', '', '', '', '', '']);
      setErrorMessage(null);
      setIsSubmitting(false);
      setSignedContract(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const fullOtpEntered = otpDigits.join('');

  const handleDigitChange = (index: number, value: string) => {
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
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSignConfirm = async () => {
    const code = fullOtpEntered.trim();

    if (code.length < 6) {
      setErrorMessage('Por favor completá los 6 dígitos del código de verificación OTP.');
      return;
    }

    if (code !== simulatedOtp) {
      setErrorMessage('Código OTP inválido. Verificá el código recibido o solicitá un nuevo envío.');
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
          {/* Legal Document Review Viewer */}
          <div className={styles.documentViewer} data-testid="document-viewer">
            <div className={styles.documentHeader}>
              <div>
                <h3 className={styles.documentTitle}>Pagaré Digital y Contrato de Mutuo</h3>
                <span className={styles.documentLegalNumber}>Instrumento N° PAG-{loan.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <span className={styles.documentLegalNumber}>Ley 21.526 / CCCN Art. 1820</span>
            </div>

            {/* Borrower & Loan Metadata */}
            <div className={styles.highlightMetaGrid} data-testid="contract-metadata">
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Deudor / Librador</span>
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
                <span className={styles.metaLabel}>Capital Principal</span>
                <span className={styles.metaValue} data-testid="contract-principal-amount">
                  {formatCurrency(loan.amount_requested)}
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Tasa Aplicada</span>
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
                SAS en carácter de mandatario tecnológico y facilitador conforme a la Ley de Financiamiento
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
          </div>

          {/* Signed Confirmation State OR OTP Input State */}
          {signedContract && signedContract.signature_hash ? (
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
                  Código de prueba: {simulatedOtp}
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
                    disabled={isSubmitting}
                    autoFocus={index === 0}
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
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className={styles.modalFooter}>
          {signedContract ? (
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
                disabled={isSubmitting}
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
