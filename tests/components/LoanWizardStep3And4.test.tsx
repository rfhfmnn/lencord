import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StepDocumentUpload, MAX_FILE_SIZE_BYTES } from '@/components/solicitar/StepDocumentUpload';
import {
  StepBankingAndSubmission,
  validateCbu,
} from '@/components/solicitar/StepBankingAndSubmission';
import { ApplicationConfirmation } from '@/components/solicitar/ApplicationConfirmation';
import { LoanWizard } from '@/components/solicitar/LoanWizard';
import { ServiceProvider } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import type { Loan } from '@/types';

describe('CBU / CVU Validation (Task 12)', () => {
  it('validates 22-digit CBU/CVU properly', () => {
    // Exactly 22 digits
    expect(validateCbu('0720123488000012345678')).toBe(true);
    expect(validateCbu('0000003100012345678901')).toBe(true);

    // Too short / too long / non-numeric
    expect(validateCbu('12345')).toBe(false);
    expect(validateCbu('072012348800001234567899')).toBe(false);
    expect(validateCbu('')).toBe(false);
  });
});

describe('Step 3: Document Uploads (Task 12)', () => {
  it('renders all 4 file upload inputs with badges', () => {
    render(<StepDocumentUpload onBack={vi.fn()} onContinue={vi.fn()} />);

    expect(screen.getByTestId('upload-card-afip')).toBeInTheDocument();
    expect(screen.getByTestId('upload-card-extractos')).toBeInTheDocument();
    expect(screen.getByTestId('upload-card-balance')).toBeInTheDocument();
    expect(screen.getByTestId('upload-card-f931')).toBeInTheDocument();

    expect(screen.getByText('Obligatorio')).toBeInTheDocument();
    expect(screen.getByText('Recomendado')).toBeInTheDocument();
    expect(screen.getAllByText('Opcional').length).toBe(2);
  });

  it('rejects non-PDF files with clear user feedback', () => {
    render(<StepDocumentUpload onBack={vi.fn()} onContinue={vi.fn()} />);

    const fileInput = screen.getByTestId('input-file-afip');
    const imageFile = new File(['dummy image content'], 'constancia.png', {
      type: 'image/png',
    });

    fireEvent.change(fileInput, { target: { files: [imageFile] } });

    expect(
      screen.getByText('Solo se permiten archivos en formato PDF.')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('badge-afip-file')).not.toBeInTheDocument();
  });

  it('rejects PDF files exceeding 10 MB with clear error feedback', () => {
    render(<StepDocumentUpload onBack={vi.fn()} onContinue={vi.fn()} />);

    const fileInput = screen.getByTestId('input-file-afip');
    const largeFile = new File(['a'], 'constancia_gigante.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(largeFile, 'size', { value: 11 * 1024 * 1024 });

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    expect(
      screen.getByText('El archivo supera el tamaño máximo permitido de 10 MB.')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('badge-afip-file')).not.toBeInTheDocument();
  });

  it('accepts valid PDF under 10 MB and shows file name and remove action', () => {
    render(<StepDocumentUpload onBack={vi.fn()} onContinue={vi.fn()} />);

    const fileInput = screen.getByTestId('input-file-afip');
    const validFile = new File(['pdf dummy binary'], 'constancia_afip_2026.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(validFile, 'size', { value: 2.4 * 1024 * 1024 });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    expect(screen.getByTestId('badge-afip-file')).toHaveTextContent(
      'constancia_afip_2026.pdf (2.4 MB)'
    );

    // Remove file
    fireEvent.click(screen.getByTestId('remove-afip-file'));
    expect(screen.queryByTestId('badge-afip-file')).not.toBeInTheDocument();
  });

  it('blocks continue and shows validation error if mandatory AFIP constancia is missing', () => {
    const onContinueMock = vi.fn();
    render(<StepDocumentUpload onBack={vi.fn()} onContinue={onContinueMock} />);

    fireEvent.click(screen.getByTestId('step3-continue-button'));

    expect(
      screen.getByText(
        'La Constancia de inscripción AFIP / ARCA es obligatoria para continuar.'
      )
    ).toBeInTheDocument();
    expect(onContinueMock).not.toHaveBeenCalled();
  });

  it('advances to next step when mandatory AFIP document is provided', () => {
    const onContinueMock = vi.fn();
    render(<StepDocumentUpload onBack={vi.fn()} onContinue={onContinueMock} />);

    const fileInput = screen.getByTestId('input-file-afip');
    const validFile = new File(['content'], 'afip.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(validFile, 'size', { value: 500 * 1024 });

    fireEvent.change(fileInput, { target: { files: [validFile] } });
    fireEvent.click(screen.getByTestId('step3-continue-button'));

    expect(onContinueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        afip_constancia: expect.objectContaining({ name: 'afip.pdf' }),
      })
    );
  });
});

describe('Step 4: Banking Verification and Submission (Task 12)', () => {
  it('renders CBU input and compliance declaration checkboxes', () => {
    render(
      <StepBankingAndSubmission
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByTestId('input-cbu')).toBeInTheDocument();
    expect(screen.getByTestId('checkbox-funds-declaration')).toBeInTheDocument();
    expect(screen.getByTestId('checkbox-terms-accepted')).toBeInTheDocument();
    expect(screen.getByTestId('step4-submit-button')).toBeInTheDocument();
  });

  it('validates 22-digit CBU and requires sworn declaration and terms checkboxes', async () => {
    const onSubmitMock = vi.fn();
    render(
      <StepBankingAndSubmission
        onBack={vi.fn()}
        onSubmit={onSubmitMock}
      />
    );

    // Click submit empty
    fireEvent.click(screen.getByTestId('step4-submit-button'));

    expect(
      screen.getByText(/Ingresá la clave bancaria uniforme/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Debes aceptar la declaración jurada sobre el origen lícito/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Debes aceptar los términos, condiciones y emisión del pagaré digital/i)
    ).toBeInTheDocument();
    expect(onSubmitMock).not.toHaveBeenCalled();

    // Fill invalid CBU (less than 22 digits)
    fireEvent.change(screen.getByTestId('input-cbu'), {
      target: { value: '0720123488' },
    });
    fireEvent.click(screen.getByTestId('step4-submit-button'));
    expect(
      screen.getByText('El CBU o CVU debe contener exactamente 22 dígitos numéricos.')
    ).toBeInTheDocument();
  });

  it('submits successfully when 22-digit CBU and all checkboxes are valid', async () => {
    const onSubmitMock = vi.fn().mockResolvedValue(undefined);
    render(
      <StepBankingAndSubmission
        onBack={vi.fn()}
        onSubmit={onSubmitMock}
      />
    );

    fireEvent.change(screen.getByTestId('input-cbu'), {
      target: { value: '0720123488000012345678' },
    });
    fireEvent.click(screen.getByTestId('checkbox-funds-declaration'));
    fireEvent.click(screen.getByTestId('checkbox-terms-accepted'));

    fireEvent.click(screen.getByTestId('step4-submit-button'));

    await waitFor(() => {
      expect(onSubmitMock).toHaveBeenCalledWith({
        cbu_cvu: '0720123488000012345678',
        funds_declaration: true,
        terms_accepted: true,
      });
    });
  });
});

describe('Full LoanWizard Integration & Application Confirmation (Task 12)', () => {
  it('submits loan application to service layer, transitions status to in_review, and displays confirmation', async () => {
    const services = createServices({ useMocks: true });
    const onSubmittedMock = vi.fn();

    // Start wizard at Step 4 with pre-filled steps 1, 2, 3
    render(
      <ServiceProvider services={services}>
        <LoanWizard
          initialStep={4}
          initialStep1Data={{
            legal_name: 'Industrias Quilmes S.A.',
            tax_id: '30-50001091-2',
            company_type: 'SA',
          }}
          initialStep2Data={{
            category: 'machinery',
            amount_requested: 12000000,
            term_months: 12,
            rate_type: 'TNA_FIXED',
            description: 'Compra de centro de mecanizado CNC.',
          }}
          initialStep3Data={{
            afip_constancia: { name: 'constancia_afip.pdf', size: 102400, type: 'application/pdf' },
            balance_sheet: { name: 'balance_2025.pdf', size: 1048576, type: 'application/pdf' },
          }}
          onSubmitted={onSubmittedMock}
        />
      </ServiceProvider>
    );

    // Fill Step 4
    fireEvent.change(screen.getByTestId('input-cbu'), {
      target: { value: '0170054320000043210987' },
    });
    fireEvent.click(screen.getByTestId('checkbox-funds-declaration'));
    fireEvent.click(screen.getByTestId('checkbox-terms-accepted'));

    // Submit
    fireEvent.click(screen.getByTestId('step4-submit-button'));

    await waitFor(() => {
      expect(screen.getByTestId('application-confirmation')).toBeInTheDocument();
    });

    expect(screen.getByText('¡Solicitud enviada con éxito!')).toBeInTheDocument();
    expect(screen.getByTestId('review-time-banner')).toHaveTextContent(/24 a 48 horas hábiles/i);
    expect(screen.getByTestId('receipt-status')).toHaveTextContent('En revisión (in_review)');
    expect(screen.getByTestId('receipt-legal-name')).toHaveTextContent('Industrias Quilmes S.A.');
    expect(screen.getByTestId('receipt-tax-id')).toHaveTextContent('30-50001091-2');
    expect(screen.getByTestId('receipt-amount')).toHaveTextContent('$ 12.000.000');
    expect(screen.getByTestId('receipt-term')).toHaveTextContent('12 meses');

    expect(onSubmittedMock).toHaveBeenCalledTimes(1);
    const createdLoan: Loan = onSubmittedMock.mock.calls[0][0];
    expect(createdLoan.status).toBe('in_review');
    expect(createdLoan.amount_requested).toBe(12000000);
    expect(createdLoan.term_months).toBe(12);
  });

  it('ApplicationConfirmation standalone component displays all receipt information', () => {
    const testLoan: Loan = {
      id: 'loan-receipt-001',
      borrower_id: 'prof-sme-001',
      amount_requested: 8000000,
      amount_funded: 0,
      term_months: 6,
      rate_type: 'CER_VARIABLE',
      investor_rate: 0,
      platform_spread: 0,
      borrower_rate: 0,
      base_uva_value: null,
      category: 'working_capital',
      status: 'in_review',
      funding_deadline: '2026-11-01T00:00:00.000Z',
      created_at: '2026-09-25T00:00:00.000Z',
    };

    render(
      <ApplicationConfirmation
        loan={testLoan}
        legalName="Alimentos Argentinos SRL"
        taxId="30-71234567-1"
      />
    );

    expect(screen.getByTestId('receipt-loan-id')).toHaveTextContent('loan-receipt-001');
    expect(screen.getByTestId('receipt-legal-name')).toHaveTextContent('Alimentos Argentinos SRL');
    expect(screen.getByTestId('receipt-tax-id')).toHaveTextContent('30-71234567-1');
    expect(screen.getByTestId('receipt-category')).toHaveTextContent('Capital de trabajo');
    expect(screen.getByTestId('receipt-amount')).toHaveTextContent('$ 8.000.000');
    expect(screen.getByTestId('receipt-term')).toHaveTextContent('6 meses');
    expect(screen.getByTestId('receipt-rate-type')).toHaveTextContent('CER + spread variable');
  });
});
