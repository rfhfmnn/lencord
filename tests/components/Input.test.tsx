import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Input } from '@/components/ui/Input';

describe('Input Primitive', () => {
  it('renders standard text input with placeholder', () => {
    render(<Input placeholder="Ingrese CUIT" />);
    const input = screen.getByPlaceholderText('Ingrese CUIT');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'text');
  });

  it('renders number input type correctly', () => {
    render(<Input type="number" placeholder="Monto a solicitar" min={1000} />);
    const input = screen.getByPlaceholderText('Monto a solicitar');
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveAttribute('min', '1000');
  });

  it('renders associated label', () => {
    render(<Input label="Monto del préstamo" id="loan-amount" />);
    const label = screen.getByText('Monto del préstamo');
    const input = screen.getByLabelText('Monto del préstamo');
    expect(label).toHaveAttribute('for', 'loan-amount');
    expect(input).toHaveAttribute('id', 'loan-amount');
  });

  it('supports prefix and suffix adornments (e.g., $ and %)', () => {
    render(
      <Input
        label="Tasa de interés"
        prefix="$"
        suffix="%"
        placeholder="100000"
      />
    );

    expect(screen.getByTestId('input-prefix')).toHaveTextContent('$');
    expect(screen.getByTestId('input-suffix')).toHaveTextContent('%');
    expect(screen.getByPlaceholderText('100000')).toBeInTheDocument();
  });

  it('displays inline validation error messages and error styling when invalid', () => {
    render(
      <Input
        label="CUIT de la PyME"
        id="cuit-input"
        error="El CUIT ingresado no es válido"
      />
    );

    const input = screen.getByLabelText('CUIT de la PyME');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'cuit-input-error');

    const errorMessage = screen.getByRole('alert');
    expect(errorMessage).toBeInTheDocument();
    expect(errorMessage).toHaveTextContent('El CUIT ingresado no es válido');
    expect(errorMessage).toHaveAttribute('id', 'cuit-input-error');
  });

  it('displays helper text when no error is present', () => {
    render(
      <Input
        label="Plazo"
        id="term-input"
        helperText="Plazo mínimo 3 meses, máximo 24 meses"
      />
    );

    expect(
      screen.getByText('Plazo mínimo 3 meses, máximo 24 meses')
    ).toBeInTheDocument();
    const input = screen.getByLabelText('Plazo');
    expect(input).toHaveAttribute('aria-describedby', 'term-input-helper');
  });

  it('handles user typing interaction', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(<Input placeholder="Nombre" onChange={handleChange} />);

    const input = screen.getByPlaceholderText('Nombre');
    await user.type(input, 'Acme Corp');

    expect(handleChange).toHaveBeenCalled();
    expect(input).toHaveValue('Acme Corp');
  });

  it('handles disabled state', () => {
    render(<Input placeholder="Solo lectura" disabled />);
    const input = screen.getByPlaceholderText('Solo lectura');
    expect(input).toBeDisabled();
  });
});
