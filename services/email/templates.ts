/**
 * Responsive Branded HTML Email Templates for Lencord FinTech Platform.
 * Compatible with modern email clients (mobile & desktop).
 */

import type {
  RegistrationEmailParams,
  LoanSubmissionEmailParams,
  CreditApprovalEmailParams,
  CreditRejectionEmailParams,
  InvestmentConfirmationEmailParams,
  InstallmentReminderEmailParams,
  NewInvestmentReceivedEmailParams,
  LoanFundingCompletedBorrowerEmailParams,
  LoanFundingCompletedInvestorEmailParams,
  PromissoryNoteSignedInvestorEmailParams,
  InstallmentPayoutCreditedEmailParams,
} from './types';

interface BaseTemplateOptions {
  title: string;
  previewText: string;
  contentHtml: string;
  actionText?: string;
  actionUrl?: string;
}

export function formatCurrency(amount: number): string {
  return `$${Number(amount || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function renderLencordBaseTemplate(options: BaseTemplateOptions): string {
  const { title, previewText, contentHtml, actionText, actionUrl } = options;

  const actionButton =
    actionText && actionUrl
      ? `
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0 16px 0;">
        <tr>
          <td align="center">
            <a href="${actionUrl}" target="_blank" style="background-color: #059669; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block; box-shadow: 0 2px 4px rgba(5, 150, 105, 0.2);">
              ${actionText}
            </a>
          </td>
        </tr>
      </table>`
      : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .content-cell { padding: 24px 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
  <!-- Preview Text -->
  <div style="display: none; font-size: 1px; color: #0f172a; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${previewText}
  </div>

  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f172a; padding: 32px 0;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table class="email-container" border="0" cellpadding="0" cellspacing="0" width="580" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);">
          
          <!-- Branded Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #090d16 0%, #1e293b 100%); padding: 28px 32px; border-bottom: 2px solid #059669;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">LENCORD</span>
                    <span style="display: inline-block; margin-left: 8px; font-size: 11px; font-weight: 700; color: #34d399; background-color: rgba(5, 150, 105, 0.2); border: 1px solid rgba(52, 211, 153, 0.3); padding: 2px 8px; border-radius: 9999px; text-transform: uppercase;">FinTech P2P</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 6px; font-size: 13px; color: #94a3b8;">
                    Plataforma de Financiamiento Colectivo y Préstamos Directos
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body Content -->
          <tr>
            <td class="content-cell" style="padding: 32px 32px 24px 32px; background-color: #ffffff;">
              <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                ${title}
              </h1>
              <div style="font-size: 15px; line-height: 1.6; color: #334155;">
                ${contentHtml}
              </div>
              ${actionButton}
            </td>
          </tr>

          <!-- Security and Regulatory Notice -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.5;">
              <p style="margin: 0 0 6px 0; font-weight: 600; color: #475569;">
                Aviso Regulatorio y de Custodia de Fondos (BCRA / CNV)
              </p>
              <p style="margin: 0;">
                Lencord no realiza intermediación financiera en los términos de la Ley N° 21.526 ni capta fondos del público. Los fondos comprometidos y las operaciones de cobro y desembolso son custodiados y canalizados a través de entidades bancarias y proveedores de servicios de pago regulados por el Banco Central de la República Argentina (BCRA).
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #0f172a; color: #94a3b8; font-size: 11px; text-align: center; line-height: 1.5;">
              <p style="margin: 0 0 4px 0;">
                © 2026 Lencord FinTech S.A. • Córdoba, Argentina
              </p>
              <p style="margin: 0;">
                Este es un mensaje automático de notificación transaccional. Por favor, no respondas directamente a este correo.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// 1. Account Registration Template
// ---------------------------------------------------------------------------
export function renderRegistrationTemplate(params: RegistrationEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const roleLabel =
    params.role === 'borrower' || params.role === 'sme'
      ? 'Empresa / PyME Solicitante'
      : 'Inversor / Proveedor de Capital';

  const subject = '¡Bienvenido a Lencord! Confirma tu cuenta';
  const previewText = `Hola ${params.recipientName}, tu cuenta en Lencord ha sido creada exitosamente.`;

  const contentHtml = `
    <p>Hola <strong>${params.recipientName}</strong>,</p>
    <p>Te damos la bienvenida a <strong>Lencord</strong>, la plataforma de crédito colaborativo que conecta directamente a pequeñas y medianas empresas con inversores.</p>
    <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #059669;">
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase;">Detalles de la cuenta</p>
      <p style="margin: 0 0 4px 0;"><strong>Perfil registrado:</strong> ${roleLabel}</p>
      <p style="margin: 0;"><strong>Correo electrónico:</strong> ${params.to}</p>
    </div>
    <p>Para comenzar a operar en la plataforma y completar tu legajo digital, ingresa al panel principal.</p>
  `;

  const html = renderLencordBaseTemplate({
    title: 'Bienvenido a Lencord',
    previewText,
    contentHtml,
    actionText: 'Ingresar a mi panel',
    actionUrl: 'https://lencord.com.ar/login',
  });

  const text = `Hola ${params.recipientName},\n\nTe damos la bienvenida a Lencord como ${roleLabel}.\nCorreo: ${params.to}\nTu cuenta está lista para operar.\n\nIngresa a https://lencord.com.ar/login`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 2. Loan Submission Receipt Template
// ---------------------------------------------------------------------------
export function renderLoanSubmissionTemplate(params: LoanSubmissionEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const formattedAmount = formatCurrency(params.amount);
  const subject = `Solicitud de crédito recibida (${params.loanId})`;
  const previewText = `Hemos recibido tu solicitud de crédito por ${formattedAmount}.`;

  const contentHtml = `
    <p>Estimado/a <strong>${params.recipientName}</strong>,</p>
    <p>Confirmamos que hemos recibido tu solicitud de crédito en <strong>Lencord</strong>. Nuestro equipo de análisis crediticio iniciará la evaluación de tu legajo de inmediato.</p>
    <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #3b82f6;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; line-height: 1.8;">
        <tr>
          <td style="color: #64748b; width: 45%;">Identificador de solicitud:</td>
          <td style="font-weight: 600; color: #0f172a;">${params.loanId}</td>
        </tr>
        <tr>
          <td style="color: #64748b;">Monto solicitado:</td>
          <td style="font-weight: 700; color: #059669;">${formattedAmount}</td>
        </tr>
        <tr>
          <td style="color: #64748b;">Destino de fondos:</td>
          <td style="font-weight: 600; color: #0f172a;">${params.category}</td>
        </tr>
        <tr>
          <td style="color: #64748b;">Estado inicial:</td>
          <td style="font-weight: 600; color: #d97706;">En revisión crediticia</td>
        </tr>
      </table>
    </div>
    <p>Te notificaremos apenas se complete la verificación de situación crediticia en BCRA y la aprobación de la tasa de subasta.</p>
  `;

  const html = renderLencordBaseTemplate({
    title: 'Solicitud de Crédito Recibida',
    previewText,
    contentHtml,
    actionText: 'Ver estado en mi panel',
    actionUrl: 'https://lencord.com.ar/dashboard/pyme',
  });

  const text = `Estimado/a ${params.recipientName},\n\nHemos recibido tu solicitud de crédito ${params.loanId} por ${formattedAmount} (${params.category}).\nEstado: En revisión crediticia.\n\nPuedes seguir su avance en https://lencord.com.ar/dashboard/pyme`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 3. Credit Approval & Auction Publication Template
// ---------------------------------------------------------------------------
export function renderCreditApprovalTemplate(params: CreditApprovalEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const formattedAmount = formatCurrency(params.amount);
  const subject = `¡Tu solicitud de crédito ha sido aprobada! (${params.loanId})`;
  const previewText = `Tu solicitud por ${formattedAmount} fue aprobada y publicada en la subasta del marketplace.`;

  const contentHtml = `
    <p>¡Excelentes noticias, <strong>${params.recipientName}</strong>!</p>
    <p>Tu solicitud de financiamiento ha sido <strong>aprobada por el comité de crédito</strong> y ya se encuentra publicada activamente en el Marketplace para recibir posturas de los inversores.</p>
    <div style="background-color: #ecfdf5; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #059669;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; line-height: 1.8;">
        <tr>
          <td style="color: #065f46; width: 45%;">Préstamo:</td>
          <td style="font-weight: 600; color: #064e3b;">${params.loanId}</td>
        </tr>
        <tr>
          <td style="color: #065f46;">Monto autorizado:</td>
          <td style="font-weight: 700; color: #059669;">${formattedAmount}</td>
        </tr>
        <tr>
          <td style="color: #065f46;">Calificación de riesgo:</td>
          <td style="font-weight: 700; color: #0f172a;">${params.riskTier}</td>
        </tr>
        <tr>
          <td style="color: #065f46;">Tasa inversor asignada:</td>
          <td style="font-weight: 600; color: #0f172a;">${params.investorRate}% TNA</td>
        </tr>
        <tr>
          <td style="color: #065f46;">Estado:</td>
          <td style="font-weight: 700; color: #059669;">Subasta Activa en Marketplace</td>
        </tr>
      </table>
    </div>
    <p>Puedes seguir el avance de fondeo en tiempo real desde tu panel de control PyME.</p>
  `;

  const html = renderLencordBaseTemplate({
    title: '¡Solicitud de Crédito Aprobada!',
    previewText,
    contentHtml,
    actionText: 'Seguir subasta en vivo',
    actionUrl: 'https://lencord.com.ar/dashboard/pyme',
  });

  const text = `¡Buenas noticias, ${params.recipientName}!\n\nTu solicitud de crédito ${params.loanId} por ${formattedAmount} fue aprobada con calificación ${params.riskTier} a una tasa del ${params.investorRate}% TNA.\nLa subasta ya está abierta en el marketplace: https://lencord.com.ar/dashboard/pyme`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 4. Credit Rejection Notice Template
// ---------------------------------------------------------------------------
export function renderCreditRejectionTemplate(params: CreditRejectionEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Actualización sobre tu solicitud de crédito (${params.loanId})`;
  const previewText = `Información sobre la evaluación de tu solicitud de crédito en Lencord.`;

  const contentHtml = `
    <p>Estimado/a <strong>${params.recipientName}</strong>,</p>
    <p>Te contactamos para informarte sobre el resultado de la evaluación de riesgo de tu solicitud de crédito <strong>${params.loanId}</strong>.</p>
    <p>Lamentamos comunicarte que, conforme a las políticas crediticias actuales de la plataforma, en esta oportunidad no ha sido posible publicar la solicitud en la subasta.</p>
    <div style="background-color: #fef2f2; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #dc2626;">
      <p style="margin: 0 0 6px 0; font-size: 13px; color: #991b1b; font-weight: 600; text-transform: uppercase;">Motivo informado por el comité</p>
      <p style="margin: 0; color: #7f1d1d; font-size: 14px;">${params.reason}</p>
    </div>
    <p>Agradecemos tu interés en Lencord. Podrás presentar una nueva solicitud una vez transcurridos 60 días o regularizada tu situación crediticia.</p>
  `;

  const html = renderLencordBaseTemplate({
    title: 'Resultado de Evaluación Crediticia',
    previewText,
    contentHtml,
    actionText: 'Ir a mi panel',
    actionUrl: 'https://lencord.com.ar/dashboard/pyme',
  });

  const text = `Estimado/a ${params.recipientName},\n\nTe informamos que tu solicitud ${params.loanId} no pudo ser aprobada en esta oportunidad.\nMotivo: ${params.reason}\n\nAnte cualquier duda, ingresa a https://lencord.com.ar/dashboard/pyme`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 5. Investment Confirmation Template
// ---------------------------------------------------------------------------
export function renderInvestmentConfirmationTemplate(params: InvestmentConfirmationEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const formattedAmount = formatCurrency(params.amount);
  const subject = `Confirmación de inversión en subasta (${params.loanId})`;
  const previewText = `Tu compromiso de inversión por ${formattedAmount} ha sido registrado con éxito.`;

  const contentHtml = `
    <p>Hola <strong>${params.recipientName}</strong>,</p>
    <p>Te confirmamos que tu orden de inversión ha sido registrada exitosamente en el libro de posturas de la subasta.</p>
    <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #059669; border: 1px solid #e2e8f0;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; line-height: 1.8;">
        <tr>
          <td style="color: #64748b; width: 45%;">Subasta / Préstamo:</td>
          <td style="font-weight: 600; color: #0f172a;">${params.loanId}</td>
        </tr>
        <tr>
          <td style="color: #64748b;">Monto invertido:</td>
          <td style="font-weight: 700; color: #059669;">${formattedAmount}</td>
        </tr>
        <tr>
          <td style="color: #64748b;">Tasa pactada:</td>
          <td style="font-weight: 600; color: #0f172a;">${params.rate}% TNA</td>
        </tr>
        <tr>
          <td style="color: #64748b;">Custodia de fondos:</td>
          <td style="font-weight: 500; color: #475569;">Retención en cuenta custodia bancaria</td>
        </tr>
      </table>
    </div>
    <p>Cuando la subasta alcance el 100% y se perfeccione el pagaré digital con la PyME, los fondos serán desembolsados y comenzará a devengarse el plan de amortización mensual.</p>
  `;

  const html = renderLencordBaseTemplate({
    title: 'Orden de Inversión Confirmada',
    previewText,
    contentHtml,
    actionText: 'Ver mi portafolio',
    actionUrl: 'https://lencord.com.ar/dashboard/inversor',
  });

  const text = `Hola ${params.recipientName},\n\nTu orden de inversión por ${formattedAmount} en el préstamo ${params.loanId} ha sido registrada al ${params.rate}% TNA.\n\nPuedes monitorear tu portafolio en https://lencord.com.ar/dashboard/inversor`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 6. Installment Reminder Template
// ---------------------------------------------------------------------------
export function renderInstallmentReminderTemplate(params: InstallmentReminderEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const formattedAmount = formatCurrency(params.amount);
  const subject = `Recordatorio de vencimiento de cuota N° ${params.installmentNumber} (${params.loanId})`;
  const previewText = `Tu cuota N° ${params.installmentNumber} por ${formattedAmount} vence el ${params.dueDate}.`;

  const contentHtml = `
    <p>Estimado/a <strong>${params.recipientName}</strong>,</p>
    <p>Te recordamos el próximo vencimiento de cuota correspondiente a tu préstamo <strong>${params.loanId}</strong>.</p>
    <div style="background-color: #fffbeb; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #f59e0b;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; line-height: 1.8;">
        <tr>
          <td style="color: #92400e; width: 45%;">Número de cuota:</td>
          <td style="font-weight: 700; color: #78350f;">Cuota ${params.installmentNumber}</td>
        </tr>
        <tr>
          <td style="color: #92400e;">Fecha de vencimiento:</td>
          <td style="font-weight: 700; color: #b45309;">${params.dueDate}</td>
        </tr>
        <tr>
          <td style="color: #92400e;">Monto a debitar:</td>
          <td style="font-weight: 700; color: #059669;">${formattedAmount}</td>
        </tr>
        <tr>
          <td style="color: #92400e;">Modalidad:</td>
          <td style="font-weight: 500; color: #78350f;">Débito directo en CBU / Transferencia</td>
        </tr>
      </table>
    </div>
    <p>Por favor, asegúrate de contar con saldo suficiente en tu cuenta bancaria declarada para evitar penalidades e intereses punitorios por mora.</p>
  `;

  const html = renderLencordBaseTemplate({
    title: 'Aviso de Vencimiento de Cuota',
    previewText,
    contentHtml,
    actionText: 'Pagar o ver cronograma',
    actionUrl: 'https://lencord.com.ar/dashboard/pyme',
  });

  const text = `Estimado/a ${params.recipientName},\n\nTu cuota N° ${params.installmentNumber} del préstamo ${params.loanId} por ${formattedAmount} vence el ${params.dueDate}.\n\nPuedes consultar el cronograma en https://lencord.com.ar/dashboard/pyme`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 7. New Investment Received Notice (PyME) - Event 1
// ---------------------------------------------------------------------------
export function renderNewInvestmentReceivedTemplate(params: NewInvestmentReceivedEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const formattedTicket = formatCurrency(params.amount);
  const formattedTotalFunded = formatCurrency(params.amountFunded);
  const formattedRequested = formatCurrency(params.amountRequested);
  const subject = `Nuevo aporte de inversión recibido en tu solicitud (${params.loanId})`;
  const previewText = `Se ha registrado una inversión por ${formattedTicket} (${params.percentage.toFixed(1)}% financiado).`;

  const contentHtml = `
    <p>Hola <strong>${params.recipientName}</strong>,</p>
    <p>¡Buenas noticias! Se ha registrado un nuevo aporte de capital por parte de un inversor en tu subasta de financiamiento.</p>
    <div style="background-color: #f0fdf4; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #059669; border: 1px solid #bbf7d0;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; line-height: 1.8;">
        <tr>
          <td style="color: #166534; width: 45%;">Préstamo / Solicitud:</td>
          <td style="font-weight: 700; color: #0f172a;">${params.loanId}</td>
        </tr>
        <tr>
          <td style="color: #166534;">Monto del aporte:</td>
          <td style="font-weight: 700; color: #059669;">${formattedTicket}</td>
        </tr>
        <tr>
          <td style="color: #166534;">Total acumulado fondeado:</td>
          <td style="font-weight: 700; color: #0f172a;">${formattedTotalFunded} de ${formattedRequested}</td>
        </tr>
        <tr>
          <td style="color: #166534;">Progreso de la subasta:</td>
          <td style="font-weight: 700; color: #059669;">${params.percentage.toFixed(1)}% financiado</td>
        </tr>
      </table>
    </div>
    <p>Puedes seguir el avance de tu fondeo en tiempo real e interactuar con tu solicitud desde el panel PyME.</p>
  `;

  const html = renderLencordBaseTemplate({
    title: 'Nuevo Aporte de Inversión',
    previewText,
    contentHtml,
    actionText: 'Ver avance en mi panel',
    actionUrl: 'https://lencord.com.ar/dashboard/pyme',
  });

  const text = `Hola ${params.recipientName},\n\nSe ha registrado un nuevo aporte de inversión por ${formattedTicket} en tu solicitud ${params.loanId}.\nProgreso acumulado: ${params.percentage.toFixed(1)}% (${formattedTotalFunded} de ${formattedRequested}).\n\nSeguí el avance en vivo en: https://lencord.com.ar/dashboard/pyme`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 8. Loan Funding Completed Notice (PyME) - Event 2
// ---------------------------------------------------------------------------
export function renderLoanFundingCompletedBorrowerTemplate(params: LoanFundingCompletedBorrowerEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const formattedAmount = formatCurrency(params.amount);
  const subject = `¡Subasta 100% financiada! Pagaré listo para tu firma digital (${params.loanId})`;
  const previewText = `¡Felicitaciones! Tu solicitud por ${formattedAmount} alcanzó el 100%. Firmá el pagaré digital para la liberación de los fondos.`;

  const contentHtml = `
    <p>¡Felicitaciones <strong>${params.recipientName}</strong>!</p>
    <p>Tu solicitud de financiamiento <strong>${params.loanId}</strong> ha alcanzado el <strong>100% de fondeo</strong> gracias al respaldo de los inversores de la comunidad.</p>
    <div style="background-color: #f0fdf4; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #059669; border: 1px solid #bbf7d0;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; line-height: 1.8;">
        <tr>
          <td style="color: #166534; width: 45%;">Monto total financiado:</td>
          <td style="font-weight: 700; color: #059669;">${formattedAmount}</td>
        </tr>
        <tr>
          <td style="color: #166534;">Próximo paso requerido:</td>
          <td style="font-weight: 700; color: #0f172a;">Firma electrónica de pagaré digital</td>
        </tr>
      </table>
    </div>
    <p>Para transferir y desembolsar los fondos inmediatamente a tu CBU bancario registrado, ingresá a tu panel PyME y validá la firma digital del pagaré.</p>
  `;

  const html = renderLencordBaseTemplate({
    title: '¡Subasta 100% Financiada!',
    previewText,
    contentHtml,
    actionText: 'Firmar pagaré digital',
    actionUrl: 'https://lencord.com.ar/dashboard/pyme',
  });

  const text = `¡Felicitaciones ${params.recipientName}!\n\nTu solicitud ${params.loanId} por ${formattedAmount} fue 100% financiada.\nPara recibir los fondos en tu CBU registrado, ingresá a firmar el pagaré digital: https://lencord.com.ar/dashboard/pyme`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 9. Loan Funding Completed Notice (Investors) - Event 2
// ---------------------------------------------------------------------------
export function renderLoanFundingCompletedInvestorTemplate(params: LoanFundingCompletedInvestorEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const formattedTicket = formatCurrency(params.amountInvested);
  const subject = `Subasta finalizada con éxito (${params.loanId})`;
  const previewText = `La subasta de ${params.borrowerName} alcanzó el 100% de su objetivo. Tu inversión por ${formattedTicket} quedó perfeccionada.`;

  const contentHtml = `
    <p>Hola <strong>${params.recipientName}</strong>,</p>
    <p>Te informamos que la subasta de financiamiento para la empresa <strong>${params.borrowerName}</strong> (Préstamo <strong>${params.loanId}</strong>) ha finalizado exitosamente al alcanzar el 100% del capital solicitado.</p>
    <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #059669; border: 1px solid #e2e8f0;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; line-height: 1.8;">
        <tr>
          <td style="color: #64748b; width: 45%;">Empresa prestataria:</td>
          <td style="font-weight: 600; color: #0f172a;">${params.borrowerName}</td>
        </tr>
        <tr>
          <td style="color: #64748b;">Tu participación comprometida:</td>
          <td style="font-weight: 700; color: #059669;">${formattedTicket}</td>
        </tr>
        <tr>
          <td style="color: #64748b;">Estado actual:</td>
          <td style="font-weight: 600; color: #0f172a;">En proceso de suscripción de pagaré y desembolso</td>
        </tr>
      </table>
    </div>
    <p>Te notificaremos en cuanto la PyME firme el pagaré digital y comience a devengarse el plan de amortización mensual.</p>
  `;

  const html = renderLencordBaseTemplate({
    title: 'Subasta Finalizada con Éxito',
    previewText,
    contentHtml,
    actionText: 'Ver mi portafolio',
    actionUrl: 'https://lencord.com.ar/dashboard/inversor',
  });

  const text = `Hola ${params.recipientName},\n\nLa subasta de ${params.borrowerName} (${params.loanId}) completó el 100% de financiamiento.\nTu participación de ${formattedTicket} quedó asignada. Podés hacer seguimiento en: https://lencord.com.ar/dashboard/inversor`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 10. Promissory Note Signed & Loan Activated Notice (Investors) - Event 3
// ---------------------------------------------------------------------------
export function renderPromissoryNoteSignedInvestorTemplate(params: PromissoryNoteSignedInvestorEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const formattedTicket = formatCurrency(params.amountInvested);
  const subject = `Pagaré firmado y crédito activado (${params.loanId})`;
  const previewText = `La PyME ${params.borrowerName} firmó el pagaré digital. Tu inversión de ${formattedTicket} ya comenzó a devengar rendimientos.`;

  const contentHtml = `
    <p>Hola <strong>${params.recipientName}</strong>,</p>
    <p>Te confirmamos que la empresa <strong>${params.borrowerName}</strong> ha suscripto electrónicamente el pagaré digital y mutuo para el préstamo <strong>${params.loanId}</strong>.</p>
    <div style="background-color: #f0fdf4; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #059669; border: 1px solid #bbf7d0;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; line-height: 1.8;">
        <tr>
          <td style="color: #166534; width: 45%;">Empresa prestataria:</td>
          <td style="font-weight: 600; color: #0f172a;">${params.borrowerName}</td>
        </tr>
        <tr>
          <td style="color: #166534;">Tu ticket invertido:</td>
          <td style="font-weight: 700; color: #059669;">${formattedTicket}</td>
        </tr>
        <tr>
          <td style="color: #166534;">Estado del préstamo:</td>
          <td style="font-weight: 700; color: #059669;">Activo / Fondos Desembolsados</td>
        </tr>
      </table>
    </div>
    <p>Los fondos han sido transferidos a la cuenta de la PyME y el cronograma de cobro mensual ya está activo. Ya puedes consultar el pagaré firmado con su Anexo de Acreedores desde tu panel de inversor.</p>
  `;

  const html = renderLencordBaseTemplate({
    title: 'Pagaré Firmado y Préstamo Activo',
    previewText,
    contentHtml,
    actionText: 'Consultar pagaré firmado',
    actionUrl: 'https://lencord.com.ar/dashboard/inversor',
  });

  const text = `Hola ${params.recipientName},\n\nLa PyME ${params.borrowerName} firmó el pagaré digital para el préstamo ${params.loanId}.\nTu inversión de ${formattedTicket} comenzó a devengar intereses.\nPodés ver la copia del pagaré firmado en tu panel: https://lencord.com.ar/dashboard/inversor`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 11. Installment Payout Credited Notice (Investors) - Event 4
// ---------------------------------------------------------------------------
export function renderInstallmentPayoutCreditedTemplate(params: InstallmentPayoutCreditedEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const formattedTotal = formatCurrency(params.totalShare);
  const formattedPrincipal = formatCurrency(params.principalShare);
  const formattedInterest = formatCurrency(params.interestShare);
  const subject = `Acreditación de cuota #${params.installmentNumber} recibida (${params.loanId})`;
  const previewText = `Se acreditó ${formattedTotal} en tu saldo en custodia por la cuota #${params.installmentNumber}.`;

  const contentHtml = `
    <p>Hola <strong>${params.recipientName}</strong>,</p>
    <p>Te confirmamos que se ha acreditado en tu saldo en custodia el cobro correspondiente a la <strong>cuota #${params.installmentNumber}</strong> del préstamo <strong>${params.loanId}</strong>.</p>
    <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #059669; border: 1px solid #e2e8f0;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; line-height: 1.8;">
        <tr>
          <td style="color: #64748b; width: 45%;">Cuota cobrada:</td>
          <td style="font-weight: 700; color: #0f172a;">Cuota #${params.installmentNumber}</td>
        </tr>
        <tr>
          <td style="color: #64748b;">Amortización de capital:</td>
          <td style="font-weight: 600; color: #0f172a;">${formattedPrincipal}</td>
        </tr>
        <tr>
          <td style="color: #64748b;">Interés compensatorio:</td>
          <td style="font-weight: 600; color: #059669;">+ ${formattedInterest}</td>
        </tr>
        <tr style="border-top: 1px solid #cbd5e1;">
          <td style="color: #0f172a; font-weight: 700; padding-top: 8px;">Total neto acreditado:</td>
          <td style="font-weight: 800; color: #059669; font-size: 16px; padding-top: 8px;">${formattedTotal}</td>
        </tr>
      </table>
    </div>
    <p>Los fondos ya se encuentran disponibles en tu saldo en custodia para reinvertir en nuevas subastas o retirar a tu cuenta bancaria (CBU/CVU).</p>
  `;

  const html = renderLencordBaseTemplate({
    title: 'Cobro de Cuota Acreditado',
    previewText,
    contentHtml,
    actionText: 'Ver saldo y movimientos',
    actionUrl: 'https://lencord.com.ar/dashboard/inversor',
  });

  const text = `Hola ${params.recipientName},\n\nSe acreditó ${formattedTotal} en tu saldo en custodia por la cuota #${params.installmentNumber} del préstamo ${params.loanId}.\nDesglose: Capital ${formattedPrincipal}, Interés ${formattedInterest}.\n\nRevisá tus movimientos en: https://lencord.com.ar/dashboard/inversor`;

  return { subject, html, text };
}
