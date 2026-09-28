/**
 * Message templates and formatters for SMS and WhatsApp notifications.
 * Tailored for Argentine PyME borrowers and investors on Lencord.
 */

import type {
  OtpSignatureAlertParams,
  LoanFundingCompletedAlertParams,
  UrgentPaymentReminderAlertParams,
} from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function formatArgentineCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Normalizes phone numbers to Argentine E.164 international format (+549...).
 */
export function normalizeArgentinePhone(phone: string): string {
  if (!phone) return phone;
  const digits = phone.replace(/\D/g, '');

  // If already starts with 549 and has 13 digits
  if (digits.startsWith('549') && digits.length >= 12) {
    return `+${digits}`;
  }

  // If starts with 54 (without 9 mobile prefix)
  if (digits.startsWith('54') && !digits.startsWith('549')) {
    const nationalNumber = digits.slice(2);
    return `+549${nationalNumber}`;
  }

  // If local Argentine number (e.g. 11 4000 0000 or 011...)
  if (digits.startsWith('0')) {
    const withoutZero = digits.slice(1);
    return `+549${withoutZero}`;
  }

  // If standard 10-digit Argentine number (e.g. 1140000000)
  if (digits.length === 10) {
    return `+549${digits}`;
  }

  return phone.startsWith('+') ? phone : `+${digits}`;
}

// ---------------------------------------------------------------------------
// OTP Signature Alert Templates
// ---------------------------------------------------------------------------

export function renderOtpSignatureSms(params: OtpSignatureAlertParams): string {
  const expiry = params.expiresInMinutes ?? 10;
  return `[Lencord] Tu codigo de seguridad para firmar el pagare digital #${params.loanId} es ${params.otpCode}. Valido por ${expiry} min. No lo compartas con nadie.`;
}

export function renderOtpSignatureWhatsApp(params: OtpSignatureAlertParams): string {
  const expiry = params.expiresInMinutes ?? 10;
  return `🔐 *Lencord - Firma de Pagaré Digital*\n\nHola *${params.recipientName}*,\n\nTu código de verificación de seguridad para firmar electrónicamente el pagaré del préstamo *#${params.loanId}* es:\n\n👉 *${params.otpCode}*\n\n⏱️ Este código vence en *${expiry} minutos*.\n⚠️ Por tu seguridad, nunca compartas este código con terceros.`;
}

// ---------------------------------------------------------------------------
// Loan Funding Completed Alert Templates
// ---------------------------------------------------------------------------

export function renderLoanFundingCompletedSms(
  params: LoanFundingCompletedAlertParams
): string {
  const formattedAmount = formatArgentineCurrency(params.amount);
  return `[Lencord] Felicitaciones ${params.recipientName}! Tu solicitud #${params.loanId} alcanzo el 100% de fondeo (${formattedAmount}). Ingresa a lencord.com.ar para firmar el pagare y recibir el desembolso.`;
}

export function renderLoanFundingCompletedWhatsApp(
  params: LoanFundingCompletedAlertParams
): string {
  const formattedAmount = formatArgentineCurrency(params.amount);
  return `🎉 *Lencord - ¡Subasta Fondeada al 100%! 🎉*\n\n¡Excelentes noticias, *${params.recipientName}*!\n\nTu solicitud de financiamiento *#${params.loanId}* ha completado el 100% de su subasta por un monto total de *${formattedAmount}*.\n\n📝 *Próximo paso obligatorio:*\nIngresá a tu Panel PyME en Lencord para revisar las condiciones finales y ratificar el pagaré digital con tu código OTP para coordinar el desembolso bancario inmediato.`;
}

// ---------------------------------------------------------------------------
// Urgent Payment Reminder Alert Templates
// ---------------------------------------------------------------------------

export function renderUrgentPaymentReminderSms(
  params: UrgentPaymentReminderAlertParams
): string {
  const formattedAmount = formatArgentineCurrency(params.amount);
  const daysText =
    params.daysRemaining !== undefined
      ? params.daysRemaining <= 0
        ? 'vence hoy'
        : `vence en ${params.daysRemaining} dias`
      : `vence el ${params.dueDate}`;

  return `[Lencord] Aviso urgente: La cuota #${params.installmentNumber} del prestamo #${params.loanId} por ${formattedAmount} ${daysText}. Evita recargos y punitorios regularizando tu saldo en tu cuenta.`;
}

export function renderUrgentPaymentReminderWhatsApp(
  params: UrgentPaymentReminderAlertParams
): string {
  const formattedAmount = formatArgentineCurrency(params.amount);
  const urgencyHeader =
    params.daysRemaining !== undefined && params.daysRemaining <= 0
      ? '🚨 *VENCIMIENTO HOY*'
      : '⚠️ *RECORDATORIO URGENTE DE PAGO*';

  return `${urgencyHeader}\n\nEstimado/a *${params.recipientName}*,\n\nTe informamos que la cuota *#${params.installmentNumber}* correspondiente al préstamo *#${params.loanId}* está próxima a vencer:\n\n• *Monto a debitar:* ${formattedAmount}\n• *Fecha de vencimiento:* ${params.dueDate}\n\nPor favor asegurate de contar con fondos suficientes en tu CBU/CVU registrado para evitar intereses punitorios o demoras en la acreditación.`;
}
