import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  cleanCuit,
  formatCuit,
  validateCuit,
} from '@/components/solicitar/cuitValidator';
import { StepProgress } from '@/components/solicitar/StepProgress';
import { StepCompanyInfo } from '@/components/solicitar/StepCompanyInfo';
import { StepProjectConditions } from '@/components/solicitar/StepProjectConditions';
import { LoanWizard } from '@/components/solicitar/LoanWizard';

describe('CUIT Validation Algorithm (Modulo 11)', () => {
  it('validates authentic Argentine CUITs with correct check-digit', () => {
    // 30-50001091-2 (Banco Galicia)
    expect(validateCuit('30-50001091-2')).toBe(true);
    expect(validateCuit('30500010912')).toBe(true);

    // 20-12345678-6
    expect(validateCuit('20-12345678-6')).toBe(true);

    // 30-71234567-1
    expect(validateCuit('30-71234567-1')).toBe(true);
  });

  it('rejects CUITs with invalid check-digits, lengths, or prefixes', () => {
    // Wrong check digit
    expect(validateCuit('30-50001091-9')).toBe(false);
    expect(validateCuit('20-12345678-0')).toBe(false);

    // Too short / too long
    expect(validateCuit('3050001091')).toBe(false);
    expect(validateCuit('305000109123')).toBe(false);

    // Invalid prefix
    expect(validateCuit('99-12345678-1')).toBe(false);
  });

  it('formats CUIT with dashes properly', () => {
    expect(formatCuit('30500010912')).toBe('30-50001091-2');
    expect(cleanCuit('30-50001091-2')).toBe('30500010912');
  });
});

describe('StepProgress Component (Task 11)', () => {
  it('indicates current step and progress properly', () => {
    const { rerender } = render(<StepProgress currentStep={1} totalSteps={4} />);
    expect(screen.getByTestId('step-counter-badge')).toHaveTextContent('Paso 1 de 4');
    expect(screen.getByTestId('step-current-name')).toHaveTextContent('Datos de la empresa');

    rerender(<StepProgress currentStep={2} totalSteps={4} />);
    expect(screen.getByTestId('step-counter-badge')).toHaveTextContent('Paso 2 de 4');
    expect(screen.getByTestId('step-current-name')).toHaveTextContent('Proyecto y condiciones');
  });
});

describe('Step 1: Company and Representative Info (Task 11)', () => {
  it('renders all Step 1 fields including separate first and last name for representative', () => {
    render(<StepCompanyInfo onContinue={vi.fn()} />);

    expect(screen.getByTestId('input-legal-name')).toBeInTheDocument();
    expect(screen.getByTestId('input-tax-id')).toBeInTheDocument();
    expect(screen.getByTestId('select-company-type')).toBeInTheDocument();
    expect(screen.getByTestId('input-start-date')).toBeInTheDocument();
    expect(screen.getByTestId('input-rep-first-name')).toBeInTheDocument();
    expect(screen.getByTestId('input-rep-last-name')).toBeInTheDocument();
    expect(screen.getByTestId('input-rep-dni')).toBeInTheDocument();
    expect(screen.getByTestId('input-rep-phone')).toBeInTheDocument();
  });

  it('triggers validation errors and blocks continue when fields are missing or CUIT is invalid', () => {
    const onContinueMock = vi.fn();
    render(<StepCompanyInfo onContinue={onContinueMock} />);

    // Try submitting empty form
    fireEvent.click(screen.getByTestId('step1-continue-button'));

    expect(screen.getByText('Ingresá la razón social o nombre de fantasía de la empresa.')).toBeInTheDocument();
    expect(screen.getByText('Ingresá el número de CUIT.')).toBeInTheDocument();
    expect(screen.getByText('Ingresá el nombre del apoderado o titular.')).toBeInTheDocument();
    expect(screen.getByText('Ingresá el apellido del apoderado o titular.')).toBeInTheDocument();
    expect(onContinueMock).not.toHaveBeenCalled();

    // Fill invalid CUIT
    fireEvent.change(screen.getByTestId('input-tax-id'), { target: { value: '20-11111111-1' } });
    fireEvent.click(screen.getByTestId('step1-continue-button'));

    expect(
      screen.getByText(/El CUIT ingresado no es válido/i)
    ).toBeInTheDocument();
    expect(onContinueMock).not.toHaveBeenCalled();
  });

  it('calls onContinue with valid Step 1 data and separate first/last name', () => {
    const onContinueMock = vi.fn();
    render(<StepCompanyInfo onContinue={onContinueMock} />);

    fireEvent.change(screen.getByTestId('input-legal-name'), { target: { value: 'Industrias Andinas S.A.' } });
    fireEvent.change(screen.getByTestId('input-tax-id'), { target: { value: '30-50001091-2' } });
    fireEvent.change(screen.getByTestId('select-company-type'), { target: { value: 'SA' } });
    fireEvent.change(screen.getByTestId('input-start-date'), { target: { value: '2020-05-15' } });
    fireEvent.change(screen.getByTestId('input-rep-first-name'), { target: { value: 'Laura' } });
    fireEvent.change(screen.getByTestId('input-rep-last-name'), { target: { value: 'Benítez' } });
    fireEvent.change(screen.getByTestId('input-rep-dni'), { target: { value: '34567890' } });
    fireEvent.change(screen.getByTestId('input-rep-phone'), { target: { value: '+54 11 4444-5555' } });

    fireEvent.click(screen.getByTestId('step1-continue-button'));

    expect(onContinueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        legal_name: 'Industrias Andinas S.A.',
        tax_id: '30-50001091-2',
        company_type: 'SA',
        start_date: '2020-05-15',
        rep_first_name: 'Laura',
        rep_last_name: 'Benítez',
        rep_name: 'Laura Benítez',
        rep_dni: '34567890',
        rep_phone: '+54 11 4444-5555',
      })
    );
  });
});

describe('Step 2: Project Conditions and Description (Task 11)', () => {
  it('renders all Step 2 fields and updates character counter live', () => {
    render(<StepProjectConditions onBack={vi.fn()} onContinue={vi.fn()} />);

    expect(screen.getByTestId('select-category')).toBeInTheDocument();
    expect(screen.getByTestId('input-amount-requested')).toBeInTheDocument();
    expect(screen.getByTestId('select-term-months')).toBeInTheDocument();
    expect(screen.getByTestId('radio-rate-fixed')).toBeInTheDocument();
    expect(screen.getByTestId('radio-rate-cer')).toBeInTheDocument();
    expect(screen.getByTestId('textarea-description')).toBeInTheDocument();
    expect(screen.getByTestId('char-counter')).toHaveTextContent('0/500 caracteres');

    // Type in textarea
    fireEvent.change(screen.getByTestId('textarea-description'), {
      target: { value: 'Compra de equipamiento de corte láser para metalurgia.' },
    });
    expect(screen.getByTestId('char-counter')).toHaveTextContent('54/500 caracteres');
  });

  it('enforces 500 characters limit on project description', () => {
    render(<StepProjectConditions onBack={vi.fn()} onContinue={vi.fn()} />);

    const textarea = screen.getByTestId('textarea-description');
    const longText = 'a'.repeat(501);

    fireEvent.change(textarea, { target: { value: longText } });

    expect(screen.getByTestId('char-counter')).toHaveTextContent('501/500 caracteres');
    expect(screen.getByText('La descripción no puede exceder los 500 caracteres.')).toBeInTheDocument();
    expect(screen.getByTestId('step2-continue-button')).toBeDisabled();
  });

  it('calls onContinue with valid Step 2 data', () => {
    const onContinueMock = vi.fn();
    render(<StepProjectConditions onBack={vi.fn()} onContinue={onContinueMock} />);

    fireEvent.change(screen.getByTestId('select-category'), { target: { value: 'machinery' } });
    fireEvent.change(screen.getByTestId('input-amount-requested'), { target: { value: '15000000' } });
    fireEvent.change(screen.getByTestId('select-term-months'), { target: { value: '12' } });
    fireEvent.click(screen.getByTestId('radio-rate-cer'));
    fireEvent.change(screen.getByTestId('textarea-description'), {
      target: { value: 'Ampliación de capacidad productiva mediante maquinaria importada.' },
    });

    fireEvent.click(screen.getByTestId('step2-continue-button'));

    expect(onContinueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'machinery',
        amount_requested: 15000000,
        term_months: 12,
        rate_type: 'CER_VARIABLE',
        description: 'Ampliación de capacidad productiva mediante maquinaria importada.',
        deadline_option: 'no_limit',
        funding_deadline: null,
      })
    );
  });

  it('renders interactive installment simulator with $ 0 when empty and calculates reactively (Issue #57)', () => {
    render(<StepProjectConditions onBack={vi.fn()} onContinue={vi.fn()} />);

    const simulatorCard = screen.getByTestId('installment-simulator-card');
    expect(simulatorCard).toBeInTheDocument();

    // Disclaimer should be clearly visible
    const disclaimer = screen.getByTestId('simulator-disclaimer');
    expect(disclaimer).toBeInTheDocument();
    expect(disclaimer).toHaveTextContent('sistema de amortización francés');
    expect(disclaimer).toHaveTextContent('No constituye oferta vinculante');

    // When amount is cleared, installment simulator should show $ 0
    fireEvent.change(screen.getByTestId('input-amount-requested'), { target: { value: '' } });
    expect(screen.getByTestId('simulator-installment-value')).toHaveTextContent('$ 0');

    // When amount is 0, installment simulator should show $ 0
    fireEvent.change(screen.getByTestId('input-amount-requested'), { target: { value: '0' } });
    expect(screen.getByTestId('simulator-installment-value')).toHaveTextContent('$ 0');

    // Fill amount and term to verify reactive calculation
    fireEvent.change(screen.getByTestId('input-amount-requested'), { target: { value: '10000000' } });
    fireEvent.change(screen.getByTestId('select-term-months'), { target: { value: '12' } });

    // Should update to non-zero formatted currency
    const updatedValue = screen.getByTestId('simulator-installment-value').textContent;
    expect(updatedValue).not.toBe('$ 0');
    expect(updatedValue).toContain('$');
  });

  it('allows selecting optional auction deadline including 15 days, custom date, and no limit (Issue #56 & #57)', () => {
    const onContinueMock = vi.fn();
    render(<StepProjectConditions onBack={vi.fn()} onContinue={onContinueMock} />);

    fireEvent.change(screen.getByTestId('select-category'), { target: { value: 'working_capital' } });
    fireEvent.change(screen.getByTestId('input-amount-requested'), { target: { value: '5000000' } });
    fireEvent.change(screen.getByTestId('select-term-months'), { target: { value: '6' } });
    fireEvent.change(screen.getByTestId('textarea-description'), {
      target: { value: 'Capital de trabajo para compra de insumos de temporada.' },
    });

    // Select 15 days deadline
    const deadlineSelect = screen.getByTestId('select-deadline-option');
    fireEvent.change(deadlineSelect, { target: { value: '15_days' } });

    fireEvent.click(screen.getByTestId('step2-continue-button'));

    expect(onContinueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        deadline_option: '15_days',
        funding_deadline: expect.any(String),
      })
    );
  });
});

describe('LoanWizard Navigation and State Preservation (Task 11)', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  });

  it('navigates from Step 1 to Step 2, and preserves state when navigating back', () => {
    render(<LoanWizard />);

    expect(screen.getByTestId('step-counter-badge')).toHaveTextContent('Paso 1 de 4');
    expect(screen.getByTestId('step1-company-form')).toBeInTheDocument();

    // Fill Step 1
    fireEvent.change(screen.getByTestId('input-legal-name'), { target: { value: 'TecnoAgro S.R.L.' } });
    fireEvent.change(screen.getByTestId('input-tax-id'), { target: { value: '30-50001091-2' } });
    fireEvent.change(screen.getByTestId('input-start-date'), { target: { value: '2021-03-01' } });
    fireEvent.change(screen.getByTestId('input-rep-first-name'), { target: { value: 'Federico' } });
    fireEvent.change(screen.getByTestId('input-rep-last-name'), { target: { value: 'Gómez' } });
    fireEvent.change(screen.getByTestId('input-rep-dni'), { target: { value: '32111222' } });
    fireEvent.change(screen.getByTestId('input-rep-phone'), { target: { value: '+54 11 9999-8888' } });

    // Click continue
    fireEvent.click(screen.getByTestId('step1-continue-button'));

    // Should now be on Step 2
    expect(screen.getByTestId('step-counter-badge')).toHaveTextContent('Paso 2 de 4');
    expect(screen.getByTestId('step2-project-form')).toBeInTheDocument();

    // Fill some Step 2 data
    fireEvent.change(screen.getByTestId('textarea-description'), {
      target: { value: 'Capital de trabajo para siembra 2026.' },
    });

    // Click back to Step 1
    fireEvent.click(screen.getByTestId('step2-back-button'));

    // Should be back on Step 1 with original values preserved
    expect(screen.getByTestId('step-counter-badge')).toHaveTextContent('Paso 1 de 4');
    expect(screen.getByTestId('input-legal-name')).toHaveValue('TecnoAgro S.R.L.');
    expect(screen.getByTestId('input-tax-id')).toHaveValue('30-50001091-2');
    expect(screen.getByTestId('input-rep-first-name')).toHaveValue('Federico');
    expect(screen.getByTestId('input-rep-last-name')).toHaveValue('Gómez');

    // Return to Step 2
    fireEvent.click(screen.getByTestId('step1-continue-button'));
    expect(screen.getByTestId('step-counter-badge')).toHaveTextContent('Paso 2 de 4');
    expect(screen.getByTestId('textarea-description')).toHaveValue('Capital de trabajo para siembra 2026.');
  });

  it('prepopulates representative first name, last name, and phone from userProfile (Issue #85)', () => {
    const mockProfile = {
      id: 'borrower-profile-123',
      legal_name: 'Pyme Pionera S.A.',
      tax_id: '30500010912',
      email: 'pionera@pyme.com',
      first_name: 'Valeria',
      last_name: 'Rossi',
      phone: '+54 9 11 4455-6677',
      isVerified: true,
    };

    render(<LoanWizard userProfile={mockProfile} />);

    expect(screen.getByTestId('input-rep-first-name')).toHaveValue('Valeria');
    expect(screen.getByTestId('input-rep-last-name')).toHaveValue('Rossi');
    expect(screen.getByTestId('input-rep-phone')).toHaveValue('+54 9 11 4455-6677');
  });
});
