import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TerminosPage from '@/app/terminos/page';
import PrivacidadPage from '@/app/privacidad/page';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { InvestmentModal } from '@/components/marketplace/InvestmentModal';
import type { Loan } from '@/types';

const mockLoan: Loan = {
  id: 'loan-legal-test',
  borrower_id: 'prof-sme-001',
  amount_requested: 1_000_000,
  amount_funded: 200_000,
  term_months: 6,
  rate_type: 'TNA_FIXED',
  investor_rate: 45.0,
  platform_spread: 2.5,
  borrower_rate: 47.5,
  base_uva_value: null,
  category: 'working_capital',
  status: 'funding',
  funding_deadline: '2026-12-31T23:59:59.000Z',
  created_at: '2026-09-01T10:00:00.000Z',
};

describe('Legal Pages, Terms and Risk Consent (Issue #72)', () => {
  describe('TerminosPage (/terminos)', () => {
    it('renders header, footer and container with data-testid="terms-page-view"', () => {
      render(<TerminosPage />);

      expect(screen.getByTestId('sticky-header')).toBeInTheDocument();
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
      expect(screen.getByTestId('terms-page-view')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: /^términos y condiciones$/i, level: 1 })
      ).toBeInTheDocument();
      expect(screen.getByText('Marco Legal')).toBeInTheDocument();
    });

    it('contains all mandatory clauses for P2P collective financing platform', () => {
      render(<TerminosPage />);

      // Clause 1: Technological platform vs Ley 21.526
      expect(screen.getByText(/Naturaleza de la plataforma y alcance del servicio \(Ley 21\.526\)/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Ley N° 21\.526 de Entidades Financieras/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/no realiza captación masiva ni intermediación financiera/i).length).toBeGreaterThan(0);

      // Clause 2: Auction rules
      expect(screen.getByText(/Mecanismo de subasta colaborativa y perfección de contratos/i)).toBeInTheDocument();
      expect(screen.getByText(/Fondeo exitoso al 100%/i)).toBeInTheDocument();

      // Clause 3: Rights and obligations of Parties
      expect(screen.getByText(/Derechos y obligaciones de las partes/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Para los Inversores/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Para las PyMEs Prestatarias/i)).toBeInTheDocument();

      // Clause 4: Service fees policy
      expect(screen.getByText(/Política de comisiones por servicio de la plataforma/i)).toBeInTheDocument();
      expect(screen.getByText(/Comisión de estructuración/i)).toBeInTheDocument();

      // Clause 5: Delinquency and debt collection mandate
      expect(screen.getByText(/Mora en los pagos y mandato irrevocable de cobranza/i)).toBeInTheDocument();
      expect(screen.getByText(/mandato irrevocable de cobranza prejudicial y judicial/i)).toBeInTheDocument();
      expect(screen.getByText(/intereses compensatorios y punitorios/i)).toBeInTheDocument();

      // Contact banner
      expect(screen.getByTestId('legal-support-banner')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /contactar a legales/i })).toHaveAttribute(
        'href',
        'mailto:legales@lencord.com'
      );
    });
  });

  describe('PrivacidadPage (/privacidad)', () => {
    it('renders header, footer and container with data-testid="privacy-page-view"', () => {
      render(<PrivacidadPage />);

      expect(screen.getByTestId('sticky-header')).toBeInTheDocument();
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
      expect(screen.getByTestId('privacy-page-view')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: /^políticas de privacidad y advertencia de riesgos$/i, level: 1 })
      ).toBeInTheDocument();
      expect(screen.getByText(/Protección de datos y riesgos/i)).toBeInTheDocument();
    });

    it('displays highlighted credit risk warning banner without state/SEDESA guarantee', () => {
      render(<PrivacidadPage />);

      const banner = screen.getByTestId('risk-warning-banner');
      expect(banner).toBeInTheDocument();
      expect(screen.getByText(/Advertencia Expresa de Riesgo Financiero y Crediticio/i)).toBeInTheDocument();
      expect(screen.getByText(/Sin Garantía Estatal ni SEDESA/i)).toBeInTheDocument();
      expect(screen.getByText(/Fondo de Garantía de los Depósitos \(SEDESA, Ley 24\.485\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Asunción de Riesgo Crediticio Total/i)).toBeInTheDocument();
      expect(screen.getByText(/mora o insolvencia de la PyME tomadora/i)).toBeInTheDocument();
    });

    it('contains privacy policy clauses under Ley 25.326 and ARCO rights', () => {
      render(<PrivacidadPage />);

      // Clause 1: Ley 25.326 and AAIP
      expect(screen.getByText(/1\. Marco normativo y responsable del tratamiento/i)).toBeInTheDocument();
      expect(screen.getByText(/Ley 25\.326 de Protección de los Datos Personales/i)).toBeInTheDocument();
      expect(screen.getByText(/Agencia de Acceso a la Información Pública \(AAIP\)/i)).toBeInTheDocument();

      // Clause 2: Data collected and KYC/UIF
      expect(screen.getByText(/2\. Datos recolectados y finalidad del tratamiento/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Unidad de Información Financiera \(UIF\)/i).length).toBeGreaterThan(0);

      // Clause 3: Encryption and Security
      expect(screen.getByText(/3\. Medidas de seguridad y cifrado informático/i)).toBeInTheDocument();
      expect(screen.getByText(/AES-256/i)).toBeInTheDocument();
      expect(screen.getByText(/TLS 1\.3/i)).toBeInTheDocument();

      // Clause 4: ARCO rights
      expect(screen.getByText(/4\. Ejercicio de Derechos ARCO/i)).toBeInTheDocument();
      expect(screen.getByText(/legales@lencord.com/i)).toBeInTheDocument();

      // Clause 5: Retention period
      expect(screen.getByText(/5\. Plazos de conservación de la información/i)).toBeInTheDocument();
      expect(screen.getByText(/10 \(diez\) años/i)).toBeInTheDocument();
    });
  });

  describe('Mandatory Terms Acceptance in RegisterForm', () => {
    it('renders terms checkbox with links to /terminos and /privacidad', () => {
      render(<RegisterForm defaultTermsAccepted={false} />);

      const checkbox = screen.getByTestId('terms-checkbox');
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();

      const terminosLink = screen.getByRole('link', { name: /^términos y condiciones$/i });
      expect(terminosLink).toHaveAttribute('href', '/terminos');

      const privacidadLink = screen.getByRole('link', { name: /^políticas de privacidad$/i });
      expect(privacidadLink).toHaveAttribute('href', '/privacidad');
    });

    it('keeps submit button disabled until terms checkbox is checked', () => {
      render(<RegisterForm defaultTermsAccepted={false} />);

      const submitBtn = screen.getByTestId('submit-register-btn');
      expect(submitBtn).toBeDisabled();

      // Fill in valid data
      fireEvent.change(screen.getByLabelText(/Razón social de la empresa/i), {
        target: { value: 'Metalúrgica Test S.A.' },
      });
      fireEvent.change(screen.getByLabelText(/CUIT de la empresa/i), {
        target: { value: '30-50001091-2' },
      });
      fireEvent.change(screen.getByLabelText(/Nombre del representante/i), {
        target: { value: 'Roberto' },
      });
      fireEvent.change(screen.getByLabelText(/Apellido del representante/i), {
        target: { value: 'Carlos' },
      });
      fireEvent.change(screen.getByLabelText(/Correo electrónico corporativo/i), {
        target: { value: 'roberto@metalurgica.com.ar' },
      });
      fireEvent.change(screen.getByLabelText(/Contraseña/i), {
        target: { value: 'ClaveSegura2026' },
      });

      // Still disabled without terms
      expect(submitBtn).toBeDisabled();

      // Accept terms
      const checkbox = screen.getByTestId('terms-checkbox');
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();

      // Button is now enabled
      expect(submitBtn).not.toBeDisabled();

      // Uncheck disables again
      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
      expect(submitBtn).toBeDisabled();
    });
  });

  describe('Mandatory Credit Risk Consent in InvestmentModal', () => {
    it('renders credit risk checkbox with links to /terminos and /privacidad', () => {
      render(
        <InvestmentModal
          isOpen={true}
          onClose={vi.fn()}
          loan={mockLoan}
          defaultCreditRiskAccepted={false}
        />
      );

      const checkbox = screen.getByTestId('credit-risk-checkbox');
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();

      const terminosLink = screen.getByRole('link', { name: /^términos y condiciones$/i });
      expect(terminosLink).toHaveAttribute('href', '/terminos');

      const riesgosLink = screen.getByRole('link', { name: /^advertencia de riesgos$/i });
      expect(riesgosLink).toHaveAttribute('href', '/privacidad');
    });

    it('blocks investment confirmation until credit risk checkbox is checked', () => {
      render(
        <InvestmentModal
          isOpen={true}
          onClose={vi.fn()}
          loan={mockLoan}
          defaultCreditRiskAccepted={false}
        />
      );

      const amountInput = screen.getByTestId('investment-amount-input');
      fireEvent.change(amountInput, { target: { value: '50000' } });

      const confirmBtn = screen.getByTestId('modal-confirm-button');
      // Amount is valid, but credit risk is not accepted -> button disabled
      expect(confirmBtn).toBeDisabled();

      // Accept credit risk
      const checkbox = screen.getByTestId('credit-risk-checkbox');
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();

      // Now confirm button is enabled
      expect(confirmBtn).not.toBeDisabled();

      // Unchecking disables confirm button again
      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
      expect(confirmBtn).toBeDisabled();
    });
  });
});
