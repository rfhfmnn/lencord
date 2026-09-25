import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Button } from '@/components/ui/Button';

describe('Button Primitive', () => {
  it('renders primary button with text content', () => {
    render(<Button variant="primary">Invertir ahora</Button>);
    const button = screen.getByRole('button', { name: /invertir ahora/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('type', 'button');
  });

  it('renders secondary and ghost button variants', () => {
    const { rerender } = render(<Button variant="secondary">Solicitar crédito</Button>);
    expect(screen.getByRole('button', { name: /solicitar crédito/i })).toBeInTheDocument();

    rerender(<Button variant="ghost">Ver detalles</Button>);
    expect(screen.getByRole('button', { name: /ver detalles/i })).toBeInTheDocument();
  });

  it('triggers onClick handler when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={handleClick}>Acción</Button>);

    await user.click(screen.getByRole('button', { name: /acción/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('handles disabled state properly', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button disabled onClick={handleClick}>
        Deshabilitado
      </Button>
    );

    const button = screen.getByRole('button', { name: /deshabilitado/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');

    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('handles loading state with spinner and accessibility attributes', () => {
    render(<Button isLoading>Confirmando</Button>);

    const button = screen.getByRole('button', { name: /confirmando/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('button-spinner')).toBeInTheDocument();
    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
  });

  it('renders icons when leftIcon or rightIcon is provided', () => {
    render(
      <Button
        leftIcon={<span data-testid="left-icon">←</span>}
        rightIcon={<span data-testid="right-icon">→</span>}
      >
        Continuar
      </Button>
    );

    expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    expect(screen.getByText('Continuar')).toBeInTheDocument();
  });
});
