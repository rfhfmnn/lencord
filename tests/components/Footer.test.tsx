import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/layout/Footer';

describe('Footer Component', () => {
  it('renders footer container element', () => {
    render(<Footer />);
    const footer = screen.getByTestId('compliance-footer');
    expect(footer).toBeInTheDocument();
  });

  it('contains the mandatory legal disclaimer regarding SAS structure and Ley 21.526', () => {
    render(<Footer />);
    const complianceSection = screen.getByTestId('compliance-section');
    expect(complianceSection).toBeInTheDocument();

    const disclaimerText = complianceSection.textContent;

    // Platform technology & SAS structure
    expect(disclaimerText).toMatch(/plataforma tecnológica/i);
    expect(disclaimerText).toMatch(/sociedad por acciones simplificada/i);
    expect(disclaimerText).toMatch(/s\.?a\.?s\.?/i);

    // Not a financial entity under Ley 21.526
    expect(disclaimerText).toMatch(/no es una entidad financiera/i);
    expect(disclaimerText).toMatch(/ley( n°)? 21\.526/i);

    // Does not capture public deposits
    expect(disclaimerText).toMatch(/captación pública de depósitos/i);
  });

  it('displays regulatory notes regarding BCRA and UIF compliance', () => {
    render(<Footer />);
    const complianceSection = screen.getByTestId('compliance-section');
    const text = complianceSection.textContent;

    // BCRA and Central de Deudores
    expect(text).toMatch(/bcra/i);
    expect(text).toMatch(/banco central de la república argentina/i);
    expect(text).toMatch(/central de deudores/i);

    // UIF compliance and AML
    expect(text).toMatch(/uif/i);
    expect(text).toMatch(/unidad de información financiera/i);
    expect(text).toMatch(/prevención de lavado de activos/i);
  });

  it('displays institutional contact links including WhatsApp channel placeholder and support email', () => {
    render(<Footer />);

    // WhatsApp placeholder link
    const whatsappLink = screen.getByTestId('whatsapp-channel-link');
    expect(whatsappLink).toBeInTheDocument();
    expect(whatsappLink).toHaveAttribute('href', expect.stringContaining('wa.me'));
    expect(whatsappLink).toHaveAttribute('target', '_blank');

    // Email link
    const mailLink = screen.getByRole('link', { name: /soporte@lencord\.com/i });
    expect(mailLink).toBeInTheDocument();
    expect(mailLink).toHaveAttribute('href', 'mailto:soporte@lencord.com');
  });

  it('renders footer navigation links', () => {
    render(<Footer />);

    const prestarLink = screen.getByRole('link', { name: /^prestar$/i });
    expect(prestarLink).toHaveAttribute('href', '/marketplace');

    const pedirLink = screen.getByRole('link', { name: /^pedir financiación$/i });
    expect(pedirLink).toHaveAttribute('href', '/solicitar');

    const comoFuncionaLink = screen.getByRole('link', { name: /^cómo funciona$/i });
    expect(comoFuncionaLink).toHaveAttribute('href', '/#como-funciona');

    const faqLink = screen.getByRole('link', { name: /^faq$/i });
    expect(faqLink).toHaveAttribute('href', '/faq');

    // Institutional links
    const terminosLink = screen.getByRole('link', { name: /^términos y condiciones$/i });
    expect(terminosLink).toHaveAttribute('href', '/terminos');

    const privacidadLink = screen.getByRole('link', { name: /^políticas de privacidad$/i });
    expect(privacidadLink).toHaveAttribute('href', '/privacidad');

    // Ensure no duplicate "Preguntas frecuentes" link is rendered in Marco Institucional
    expect(screen.queryByRole('link', { name: /^preguntas frecuentes$/i })).not.toBeInTheDocument();
  });

  it('renders copyright and brand notice', () => {
    render(<Footer />);
    expect(screen.getByText(/lencord s\.?a\.?s\.?\.\s*todos los derechos reservados/i)).toBeInTheDocument();
  });
});
