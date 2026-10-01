import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TerminosPage from '@/app/terminos/page';
import PrivacidadPage from '@/app/privacidad/page';
import { LegalPlaceholderView } from '@/components/legal/LegalPlaceholderView';

describe('Legal Pages (/terminos and /privacidad)', () => {
  describe('TerminosPage (/terminos)', () => {
    it('renders the complete terms page with Header, LegalPlaceholderView, and Footer', () => {
      render(<TerminosPage />);

      // Sticky Header & Footer
      expect(screen.getByTestId('sticky-header')).toBeInTheDocument();
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();

      // Heading and badge
      expect(
        screen.getByRole('heading', { name: /^términos y condiciones$/i, level: 1 })
      ).toBeInTheDocument();
      expect(screen.getByText('Marco Legal')).toBeInTheDocument();

      // Placeholder status indicating section is under preparation
      expect(screen.getByText('Apartado en preparación')).toBeInTheDocument();
      expect(
        screen.getByText(/los términos y condiciones de uso se encuentran en proceso de redacción/i)
      ).toBeInTheDocument();

      // Support contact banner
      expect(screen.getByTestId('legal-support-banner')).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /contactar a soporte/i })
      ).toHaveAttribute('href', 'mailto:soporte@lencord.com');
    });
  });

  describe('PrivacidadPage (/privacidad)', () => {
    it('renders the complete privacy page with Header, LegalPlaceholderView, and Footer', () => {
      render(<PrivacidadPage />);

      // Sticky Header & Footer
      expect(screen.getByTestId('sticky-header')).toBeInTheDocument();
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();

      // Heading and badge
      expect(
        screen.getByRole('heading', { name: /^políticas de privacidad$/i, level: 1 })
      ).toBeInTheDocument();
      expect(screen.getByText('Protección de Datos')).toBeInTheDocument();

      // Placeholder status indicating section is under preparation
      expect(screen.getByText('Apartado en preparación')).toBeInTheDocument();
      expect(
        screen.getByText(/la política de privacidad y protección de datos personales se encuentra en proceso/i)
      ).toBeInTheDocument();

      // Support contact banner
      expect(screen.getByTestId('legal-support-banner')).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /contactar a soporte/i })
      ).toHaveAttribute('href', 'mailto:soporte@lencord.com');
    });
  });

  describe('LegalPlaceholderView Standalone', () => {
    it('renders custom badge, titles, descriptions, and placeholder text', () => {
      render(
        <LegalPlaceholderView
          badge="Seguridad"
          title="Documento de Prueba"
          subtitle="Subtítulo descriptivo"
          sectionTitle="Sección de prueba"
          sectionDescription="Descripción detallada de la sección"
          placeholderTitle="Próximamente disponible"
          placeholderText="Texto descriptivo del estado en preparación."
          testId="custom-legal-view"
        />
      );

      expect(screen.getByTestId('custom-legal-view')).toBeInTheDocument();
      expect(screen.getByText('Seguridad')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Documento de Prueba', level: 1 })).toBeInTheDocument();
      expect(screen.getByText('Subtítulo descriptivo')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Sección de prueba', level: 2 })).toBeInTheDocument();
      expect(screen.getByText('Descripción detallada de la sección')).toBeInTheDocument();
      expect(screen.getByText('Próximamente disponible')).toBeInTheDocument();
      expect(screen.getByText('Texto descriptivo del estado en preparación.')).toBeInTheDocument();
    });
  });
});
